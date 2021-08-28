const helper = require('think-helper');
const parser = require('ua-parser-js');
const BaseRest = require('./rest');
const akismet = require('../service/akismet');
const { getMarkdownParser } = require('../service/markdown');

async function formatCmt(
  { ua, user_id, ...comment },
  users = [],
  { avatarProvider }
) {
  ua = parser(ua);
  if (!think.config('disableUserAgent')) {
    comment.browser = `${ua.browser.name || ''}${(ua.browser.version || '')
      .split('.')
      .slice(0, 2)
      .join('.')}`;
    comment.os = [ua.os.name, ua.os.version].filter((v) => v).join(' ');
  }

  if (user_id) {
    const user = users.find(({ objectId }) => user_id === objectId);

    if (user) {
      comment.nick = user.display_name;
      comment.mail = user.email;
      comment.link = user.url;
      comment.type = user.type;

      let { avatar } = user;
      if (avatar) {
        if (/(github)/i.test(avatar) && !avatar.includes(avatarProvider)) {
          avatar = avatarProvider + '?url=' + encodeURIComponent(avatar);
        }
        comment.avatar = avatar;
      }
    }
  }
  comment.mail = helper.md5(
    comment.mail ? comment.mail.toLowerCase() : comment.mail
  );

  return comment;
}

module.exports = class extends BaseRest {
  constructor(ctx) {
    super(ctx);
    this.modelInstance = this.service(
      `storage/${this.config('storage')}`,
      'Comment'
    );

    this.parser = getMarkdownParser();
  }

  async getAction() {
    const { type } = this.get();

    switch (type) {
      case 'recent': {
        const { count } = this.get();
        const comments = await this.modelInstance.select(
          { status: ['NOT IN', ['waiting', 'spam']] },
          { desc: 'insertedAt', limit: count }
        );

        const userModel = this.service(
          `storage/${this.config('storage')}`,
          'Users'
        );
        const user_ids = Array.from(
          new Set(comments.map(({ user_id }) => user_id).filter((v) => v))
        );

        let users = [];
        if (user_ids.length) {
          users = await userModel.select(
            { objectId: ['IN', user_ids] },
            {
              field: ['display_name', 'email', 'url', 'type', 'avatar'],
            }
          );
        }

        return this.json(
          await Promise.all(
            comments.map((cmt) => formatCmt(cmt, users, this.config()))
          )
        );
      }

      case 'count': {
        const { url } = this.get();
        const data = await this.modelInstance.select(
          {
            url: ['IN', url],
            status: ['NOT IN', ['waiting', 'spam']],
          },
          { field: ['url'] }
        );
        const counts = url.map(
          (u) => data.filter(({ url }) => url === u).length
        );

        return this.json(counts.length === 1 ? counts[0] : counts);
      }

      case 'list': {
        const { page, pageSize, owner, status, keyword } = this.get();
        const where = {};

        if (owner === 'mine') {
          const { userInfo } = this.ctx.state;
          where.mail = userInfo.email;
        }

        if (status) {
          where.status = status;

          // compat with valine old data without status property
          if (status === 'approved') {
            where.status = ['NOT IN', ['waiting', 'spam']];
          }
        }

        if (keyword) {
          where.comment = ['LIKE', `%${keyword}%`];
        }

        const count = await this.modelInstance.count(where);
        const spamCount = await this.modelInstance.count({ status: 'spam' });
        const waitingCount = await this.modelInstance.count({
          status: 'waiting',
        });
        const comments = await this.modelInstance.select(where, {
          desc: 'insertedAt',
          limit: pageSize,
          offset: Math.max((page - 1) * pageSize, 0),
        });

        return this.success({
          page,
          totalPages: Math.ceil(count / pageSize),
          pageSize,
          spamCount,
          waitingCount,
          data: comments,
        });
      }

      default: {
        const { path: url, page, pageSize } = this.get();

        const comments = await this.modelInstance.select(
          {
            url,
            status: ['NOT IN', ['waiting', 'spam']],
          },
          {
            desc: 'insertedAt',
            field: [
              'comment',
              'insertedAt',
              'link',
              'mail',
              'nick',
              'pid',
              'rid',
              'ua',
              'user_id',
            ],
          }
        );

        const userModel = this.service(
          `storage/${this.config('storage')}`,
          'Users'
        );
        const user_ids = Array.from(
          new Set(comments.map(({ user_id }) => user_id).filter((v) => v))
        );
        let users = [];

        if (user_ids.length) {
          users = await userModel.select(
            { objectId: ['IN', user_ids] },
            {
              field: ['display_name', 'email', 'url', 'type', 'avatar'],
            }
          );
        }

        const rootCount = comments.filter(({ rid }) => !rid).length;
        const pageOffset = Math.max((page - 1) * pageSize, 0);
        const rootComments = comments
          .filter(({ rid }) => !rid)
          .slice(pageOffset, pageOffset + pageSize);

        rootComments.sort((cmtA, cmtB) => {
          if (cmtA.sticky) {
            return 1;
          }
          if (cmtB.sticky) {
            return -1;
          }
          return 0;
        });

        return this.json({
          page,
          totalPages: Math.ceil(rootCount / pageSize),
          pageSize,
          count: comments.length,
          data: await Promise.all(
            rootComments.map(async (comment) => {
              const cmt = await formatCmt(comment, users, this.config());
              cmt.children = await Promise.all(
                comments
                  .filter(({ rid }) => rid === cmt.objectId)
                  .map((cmt) => formatCmt(cmt, users, this.config()))
                  .reverse()
              );
              return cmt;
            })
          ),
        });
      }
    }
  }

  async postAction() {
    think.logger.debug('Post Comment Start!');

    const { comment, link, mail, nick, pid, rid, ua, url, at } = this.post();
    const data = {
      link,
      mail,
      nick,
      pid,
      rid,
      ua,
      url,
      ip: this.ctx.ip,
      insertedAt: new Date(),
      comment: this.parser(comment),
      user_id: this.ctx.state.userInfo.objectId,
    };

    if (pid) {
      data.comment = data.comment.replace(
        '<p>',
        `<p><a class="at" href="#${pid}">@${at}</a> , `
      );
    }

    think.logger.debug('Post Comment initial Data:', data);

    const { userInfo } = this.ctx.state;

    if (!userInfo || userInfo.type !== 'administrator') {
      /** IP disallowList */
      const { disallowIPList } = this.config();

      if (
        think.isArray(disallowIPList) &&
        disallowIPList.length &&
        disallowIPList.includes(data.ip)
      ) {
        think.logger.debug(`Comment IP ${data.ip} is in disallowIPList`);

        return this.ctx.throw(403);
      }

      think.logger.debug(`Comment IP ${data.ip} check OK!`);

      /** Duplicate content detect */
      const duplicate = await this.modelInstance.select({
        url,
        mail: data.mail,
        nick: data.nick,
        link: data.link,
        comment: data.comment,
      });

      if (!think.isEmpty(duplicate)) {
        think.logger.debug(
          'The comment author had post same comment content before'
        );

        return this.fail('Duplicate Content');
      }

      think.logger.debug('Comment duplicate check OK!');

      /** IP Frequence */
      const { IPQPS = 60 } = process.env;

      const recent = await this.modelInstance.select({
        ip: this.ctx.ip,
        insertedAt: ['>', new Date(Date.now() - IPQPS * 1000)],
      });

      if (!think.isEmpty(recent)) {
        think.logger.debug(`The author has posted in ${IPQPS} seconeds.`);
        return this.fail('Comment too fast!');
      }

      think.logger.debug(`Comment post frequence check OK!`);

      /** Akismet */
      const { COMMENT_AUDIT, AUTHOR_EMAIL, BLOGGER_EMAIL } = process.env;
      const AUTHOR = AUTHOR_EMAIL || BLOGGER_EMAIL;
      const isAuthorComment = AUTHOR
        ? data.mail.toLowerCase() === AUTHOR.toLowerCase()
        : false;

      data.status = COMMENT_AUDIT && !isAuthorComment ? 'waiting' : 'approved';

      think.logger.debug(`Comment initial status is ${data.status}`);

      if (data.status === 'approved') {
        const spam = await akismet(
          data,
          this.ctx.protocol + '://' + this.ctx.host
        ).catch((e) => console.log(e)); // ignore akismet error

        if (spam === true) {
          data.status = 'spam';
        }
      }

      think.logger.debug(`Comment akismet check result: ${data.status}`);

      if (data.status !== 'spam') {
        /** KeyWord Filter */
        const { forbiddenWords } = this.config();

        if (!think.isEmpty(forbiddenWords)) {
          const regexp = new RegExp('(' + forbiddenWords.join('|') + ')', 'ig');
          if (regexp.test(comment)) {
            data.status = 'spam';
          }
        }
      }

      think.logger.debug(`Comment keyword check result: ${data.status}`);
    } else {
      data.status = 'approved';
    }

    const preSaveResp = await this.hook('preSave', data);

    if (preSaveResp) {
      return this.fail(preSaveResp.errmsg);
    }

    think.logger.debug(`Comment post hooks preSave done!`);

    const resp = await this.modelInstance.add(data);

    think.logger.debug(`Comment have been added to storage.`);

    let parrentComment;

    if (pid) {
      parrentComment = await this.modelInstance.select({ objectId: pid });
      parrentComment = parrentComment[0];
    }

    if (comment.status !== 'spam') {
      const notify = this.service('notify');
      await notify.run({ ...resp, rawComment: comment }, parrentComment);
    }

    think.logger.debug(`Comment notify done!`);

    await this.hook('postSave', resp, parrentComment);

    think.logger.debug(`Comment post hooks postSave done!`);

    return this.success(await formatCmt(resp, [userInfo], this.config()));
  }

  async putAction() {
    const data = this.post();
    const oldData = await this.modelInstance.select({ objectId: this.id });
    const preUpdateResp = await this.hook('preUpdate', {
      ...data,
      objectId: this.id,
    });

    if (preUpdateResp) {
      return this.fail(preUpdateResp);
    }

    await this.modelInstance.update(data, { objectId: this.id });

    if (
      oldData.status === 'waiting' &&
      data.status === 'approved' &&
      oldData.pid
    ) {
      let pComment = await this.modelInstance.select({ objectId: oldData.pid });
      pComment = pComment[0];

      const notify = this.service('notify');
      await notify.run(oldData, pComment, true);
    }

    await this.hook('postUpdate', data);

    return this.success();
  }

  async deleteAction() {
    const preDeleteResp = await this.hook('preDelete', this.id);

    if (preDeleteResp) {
      return this.fail(preDeleteResp);
    }

    await this.modelInstance.delete({ objectId: this.id });
    await this.hook('postDelete', this.id);

    return this.success();
  }
};
