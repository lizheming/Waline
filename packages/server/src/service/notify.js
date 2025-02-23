const crypto = require('node:crypto');

const FormData = require('form-data');
const nodemailer = require('nodemailer');

module.exports = class extends think.Service {
  constructor(ctx) {
    super(ctx);

    this.ctx = ctx;
    const {
      SMTP_USER,
      SMTP_PASS,
      SMTP_HOST,
      SMTP_PORT,
      SMTP_SECURE,
      SMTP_SERVICE,
    } = process.env;

    if (SMTP_HOST || SMTP_SERVICE) {
      const config = {
        auth: { user: SMTP_USER, pass: SMTP_PASS },
      };

      if (SMTP_SERVICE) {
        config.service = SMTP_SERVICE;
      } else {
        config.host = SMTP_HOST;
        config.port = parseInt(SMTP_PORT);
        config.secure = SMTP_SECURE && SMTP_SECURE !== 'false';
      }
      this.transporter = nodemailer.createTransport(config);
    }
  }

  async sleep(second) {
    return new Promise((resolve) => setTimeout(resolve, second * 1000));
  }

  async mail({ to, title, content }, self, parent) {
    if (!this.transporter) {
      return;
    }

    const { SITE_NAME, SITE_URL, SMTP_USER, SENDER_EMAIL, SENDER_NAME } =
      process.env;
    const data = {
      self,
      parent,
      site: {
        name: SITE_NAME,
        url: SITE_URL,
        postUrl: SITE_URL + self.url + '#' + self.objectId,
      },
    };

    title = this.ctx.locale(title, data);
    content = this.ctx.locale(content, data);

    return this.transporter.sendMail({
      from:
        SENDER_EMAIL && SENDER_NAME
          ? `"${SENDER_NAME}" <${SENDER_EMAIL}>`
          : SMTP_USER,
      to,
      subject: title,
      html: content,
    });
  }

  async wechat({ title, content }, self, parent) {
    const { SC_KEY, SITE_NAME, SITE_URL } = process.env;

    if (!SC_KEY) {
      return false;
    }

    const data = {
      self,
      parent,
      site: {
        name: SITE_NAME,
        url: SITE_URL,
        postUrl: SITE_URL + self.url + '#' + self.objectId,
      },
    };

    const contentWechat =
      think.config('SCTemplate') ||
      `{{site.name|safe}} 有新评论啦
【评论者昵称】：{{self.nick}}
【评论者邮箱】：{{self.mail}} 
【内容】：{{self.comment}}
【地址】：{{site.postUrl}}`;

    title = this.ctx.locale(title, data);
    content = this.ctx.locale(contentWechat, data);

    const form = new FormData();

    form.append('text', title);
    form.append('desp', content);

    return fetch(`https://sctapi.ftqq.com/${SC_KEY}.send`, {
      method: 'POST',
      headers: form.getHeaders(),
      body: form,
    }).then((resp) => resp.json());
  }

  async qywxAmWechat({ title, content }, self, parent) {
    const { QYWX_AM, QYWX_PROXY, QYWX_PROXY_PORT, SITE_NAME, SITE_URL } =
      process.env;

    if (!QYWX_AM) {
      return false;
    }

    const QYWX_AM_AY = QYWX_AM.split(',');
    const comment = self.comment
      .replace(/<a href="(.*?)">(.*?)<\/a>/g, '\n[$2] $1\n')
      .replace(/<[^>]+>/g, '');
    const postName = self.url;

    const data = {
      self: {
        ...self,
        comment,
      },
      postName,
      parent,
      site: {
        name: SITE_NAME,
        url: SITE_URL,
        postUrl: SITE_URL + self.url + '#' + self.objectId,
      },
    };

    const contentWechat =
      think.config('WXTemplate') ||
      `💬 {{site.name|safe}}的文章《{{postName}}》有新评论啦 
【评论者昵称】：{{self.nick}}
【评论者邮箱】：{{self.mail}} 
【内容】：{{self.comment}} 
<a href='{{site.postUrl}}'>查看详情</a>`;

    title = this.ctx.locale(title, data);
    const desp = this.ctx.locale(contentWechat, data);

    content = desp.replace(/\n/g, '<br/>');

    const querystring = new URLSearchParams();

    querystring.set('corpid', `${QYWX_AM_AY[0]}`);
    querystring.set('corpsecret', `${QYWX_AM_AY[1]}`);

    let baseUrl = 'https://qyapi.weixin.qq.com';

    if (QYWX_PROXY) {
      if (!QYWX_PROXY_PORT) {
        baseUrl = `http://${QYWX_PROXY}`;
      } else {
        baseUrl = `http://${QYWX_PROXY}:${QYWX_PROXY_PORT}`;
      }
    }

    const { access_token } = await fetch(
      `${baseUrl}/cgi-bin/gettoken?${querystring.toString()}`,
      {
        headers: {
          'content-type': 'application/json',
        },
      },
    ).then((resp) => resp.json());

    return fetch(
      `${baseUrl}/cgi-bin/message/send?access_token=${access_token}`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          touser: `${QYWX_AM_AY[2]}`,
          agentid: `${QYWX_AM_AY[3]}`,
          msgtype: 'mpnews',
          mpnews: {
            articles: [
              {
                title,
                thumb_media_id: `${QYWX_AM_AY[4]}`,
                author: `Waline Comment`,
                content_source_url: `${data.site.postUrl}`,
                content: `${content}`,
                digest: `${desp}`,
              },
            ],
          },
        }),
      },
    ).then((resp) => resp.json());
  }

  async qq(self, parent) {
    const { QMSG_KEY, QQ_ID, SITE_NAME, SITE_URL, QMSG_HOST } = process.env;

    if (!QMSG_KEY) {
      return false;
    }

    const comment = self.comment
      .replace(/<a href="(.*?)">(.*?)<\/a>/g, '')
      .replace(/<[^>]+>/g, '');

    const data = {
      self: {
        ...self,
        comment,
      },
      parent,
      site: {
        name: SITE_NAME,
        url: SITE_URL,
        postUrl: SITE_URL + self.url + '#' + self.objectId,
      },
    };

    const contentQQ =
      think.config('QQTemplate') ||
      `💬 {{site.name|safe}} 有新评论啦
{{self.nick}} 评论道：
{{self.comment}}
仅供预览评论，请前往上述页面查看完整內容。`;

    const form = new FormData();

    form.append('msg', this.ctx.locale(contentQQ, data));
    form.append('qq', QQ_ID);

    const qmsgHost = QMSG_HOST
      ? QMSG_HOST.replace(/\/$/, '')
      : 'https://qmsg.zendee.cn';

    return fetch(`${qmsgHost}/send/${QMSG_KEY}`, {
      method: 'POST',
      header: form.getHeaders(),
      body: form,
    }).then((resp) => resp.json());
  }

  async telegram(self, parent) {
    const { TG_BOT_TOKEN, TG_CHAT_ID, SITE_NAME, SITE_URL } = process.env;

    if (!TG_BOT_TOKEN || !TG_CHAT_ID) {
      return false;
    }

    let commentLink = '';
    const href = self.comment.match(/<a href="(.*?)">(.*?)<\/a>/g);

    if (href !== null) {
      for (let i = 0; i < href.length; i++) {
        href[i] =
          '[Link: ' +
          href[i].replace(/<a href="(.*?)">(.*?)<\/a>/g, '$2') +
          '](' +
          href[i].replace(/<a href="(.*?)">(.*?)<\/a>/g, '$1') +
          ')  ';
        commentLink = commentLink + href[i];
      }
    }
    if (commentLink !== '') {
      commentLink = `\n` + commentLink + `\n`;
    }
    const comment = self.comment
      .replace(/<a href="(.*?)">(.*?)<\/a>/g, '[Link:$2]')
      .replace(/<[^>]+>/g, '');

    const contentTG =
      think.config('TGTemplate') ||
      `💬 *[{{site.name}}]({{site.url}}) 有新评论啦*

*{{self.nick}}* 回复说：

\`\`\`
{{self.comment-}}
\`\`\`
{{-self.commentLink}}
*邮箱：*\`{{self.mail}}\`
*审核：*{{self.status}} 

仅供评论预览，点击[查看完整內容]({{site.postUrl}})`;

    const data = {
      self: {
        ...self,
        comment,
        commentLink,
      },
      parent,
      site: {
        name: SITE_NAME,
        url: SITE_URL,
        postUrl: SITE_URL + self.url + '#' + self.objectId,
      },
    };

    const form = new FormData();

    form.append('text', this.ctx.locale(contentTG, data));
    form.append('chat_id', TG_CHAT_ID);
    form.append('parse_mode', 'MarkdownV2');

    const resp = await fetch(
      `https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        header: form.getHeaders(),
        body: form,
      },
    ).then((resp) => resp.json());

    if (!resp.ok) {
      console.log('Telegram Notification Failed:' + JSON.stringify(resp));
    }
  }

  async pushplus({ title, content }, self, parent) {
    const {
      PUSH_PLUS_KEY,
      PUSH_PLUS_TOPIC: topic,
      PUSH_PLUS_TEMPLATE: template,
      PUSH_PLUS_CHANNEL: channel,
      PUSH_PLUS_WEBHOOK: webhook,
      PUSH_PLUS_CALLBACKURL: callbackUrl,
      SITE_NAME,
      SITE_URL,
    } = process.env;

    if (!PUSH_PLUS_KEY) {
      return false;
    }

    const data = {
      self,
      parent,
      site: {
        name: SITE_NAME,
        url: SITE_URL,
        postUrl: SITE_URL + self.url + '#' + self.objectId,
      },
    };

    title = this.ctx.locale(title, data);
    content = this.ctx.locale(content, data);

    const form = new FormData();

    if (topic) form.append('topic', topic);
    if (template) form.append('template', template);
    if (channel) form.append('channel', channel);
    if (webhook) form.append('webhook', webhook);
    if (callbackUrl) form.append('callbackUrl', callbackUrl);
    if (title) form.append('title', title);
    if (content) form.append('content', content);

    return fetch(`http://www.pushplus.plus/send/${PUSH_PLUS_KEY}`, {
      method: 'POST',
      header: form.getHeaders(),
      body: form,
    }).then((resp) => resp.json());
  }

  async discord({ title, content }, self, parent) {
    const { DISCORD_WEBHOOK, SITE_NAME, SITE_URL } = process.env;

    if (!DISCORD_WEBHOOK) {
      return false;
    }

    const data = {
      self,
      parent,
      site: {
        name: SITE_NAME,
        url: SITE_URL,
        postUrl: SITE_URL + self.url + '#' + self.objectId,
      },
    };

    title = this.ctx.locale(title, data);
    content = this.ctx.locale(
      think.config('DiscordTemplate') ||
        `💬 {{site.name|safe}} 有新评论啦 
    【评论者昵称】：{{self.nick}}
    【评论者邮箱】：{{self.mail}} 
    【内容】：{{self.comment}} 
    【地址】：{{site.postUrl}}`,
      data,
    );

    const form = new FormData();

    form.append('content', `${title}\n${content}`);

    return fetch(DISCORD_WEBHOOK, {
      method: 'POST',
      header: form.getHeaders(),
      body: form,
    }).then((resp) => resp.statusText);
    // Expected return value: No Content
    // Since Discord doesn't return any response body on success, we just return the status text.
  }

  async lark({ title, content }, self, parent) {
    const { LARK_WEBHOOK, LARK_SECRET, SITE_NAME, SITE_URL } = process.env;

    if (!LARK_WEBHOOK) {
      return false;
    }

    // 文章地址
    const postUrl = SITE_URL + self.url;
    // 评论地址
    const commentUrl = SITE_URL + self.url + '#' + self.objectId;

    let signData = {};
    const msg = {
      "msg_type": "interactive",
      "card": {
        "header": {
          "template": "blue",
          "title": {
            "tag": "plain_text",
            "content": `🌥️🌥️🌥️ ${SITE_NAME} 有新评论啦`
          }
        },
        "elements": [
          {
            "tag": "markdown",
            "content": `**文章地址:** [${postUrl}](${postUrl})`
          },
          {
            "tag": "hr"
          },
          {
            "tag": "column_set",
            "flex_mode": "none",
            "background_style": "default",
            "columns": [
              {
                "tag": "column",
                "width": "weighted",
                "weight": 1,
                "vertical_align": "top",
                "elements": [
                  {
                    "tag": "markdown",
                    "content": `**🌥️ 站点名称\n<font color='red'> ${SITE_NAME}</font>** `,
                    "text_align": "center"
                  }
                ]
              },
              {
                "tag": "column",
                "width": "weighted",
                "weight": 1,
                "vertical_align": "top",
                "elements": [
                  {
                    "tag": "markdown",
                    "content": `**👤 昵称** \n[${self.nick}](${self.link})`,
                    "text_align": "center"
                  }
                ]
              },
              {
                "tag": "column",
                "width": "weighted",
                "weight": 1,
                "vertical_align": "top",
                "elements": [
                  {
                    "tag": "markdown",
                    "content": `**📪 邮箱\n<font color='green'> ${self.mail}</font>**`,
                    "text_align": "center"
                  }
                ]
              }
            ]
          },
          {
            "tag": "column_set",
            "flex_mode": "none",
            "background_style": "grey",
            "columns": [
              {
                "tag": "column",
                "width": "weighted",
                "weight": 1,
                "vertical_align": "top",
                "elements": [
                  {
                    "tag": "markdown",
                    "content": "**📝 评论内容 📝**",
                    "text_align": "center"
                  },
                  {
                    "tag": "markdown",
                    "content": self.comment
                  }
                ]
              }
            ]
          },
          {
            "tag": "action",
            "actions": [
              {
                "tag": "button",
                "text": {
                  "tag": "plain_text",
                  "content": "查看完整內容"
                },
                "type": "primary",
                "multi_url": {
                  "url": commentUrl,
                  "pc_url": "",
                  "android_url": "",
                  "ios_url": ""
                }
              }
            ]
          }
        ]
      }
    };

    const sign = (timestamp, secret) => {
      const signStr = timestamp + '\n' + secret;

      return crypto.createHmac('sha256', signStr).update('').digest('base64');
    };

    if (LARK_SECRET) {
      const timestamp = parseInt(+new Date() / 1000);

      signData = { timestamp: timestamp, sign: sign(timestamp, LARK_SECRET) };
    }

    const resp = await fetch(LARK_WEBHOOK, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...signData,
        ...msg,
      }),
    }).then((resp) => resp.json());

    if (resp.status !== 200) {
      console.log('Lark Notification Failed:' + JSON.stringify(resp));
    }

    console.log('FeiShu Notification Success:' + JSON.stringify(resp));
  }

  async run(comment, parent, disableAuthorNotify = false) {
    const { AUTHOR_EMAIL, DISABLE_AUTHOR_NOTIFY } = process.env;
    const { mailSubject, mailTemplate, mailSubjectAdmin, mailTemplateAdmin } =
      think.config();
    const AUTHOR = AUTHOR_EMAIL;

    const mailList = [];
    const isAuthorComment = AUTHOR
      ? (comment.mail || '').toLowerCase() === AUTHOR.toLowerCase()
      : false;
    const isReplyAuthor = AUTHOR
      ? parent && (parent.mail || '').toLowerCase() === AUTHOR.toLowerCase()
      : false;
    const isCommentSelf =
      parent &&
      (parent.mail || '').toLowerCase() === (comment.mail || '').toLowerCase();

    const title = mailSubjectAdmin || 'MAIL_SUBJECT_ADMIN';
    const content = mailTemplateAdmin || 'MAIL_TEMPLATE_ADMIN';

    if (!DISABLE_AUTHOR_NOTIFY && !isAuthorComment && !disableAuthorNotify) {
      const wechat = await this.wechat({ title, content }, comment, parent);
      const qywxAmWechat = await this.qywxAmWechat(
        { title, content },
        comment,
        parent,
      );
      const qq = await this.qq(comment, parent);
      const telegram = await this.telegram(comment, parent);
      const pushplus = await this.pushplus({ title, content }, comment, parent);
      const discord = await this.discord({ title, content }, comment, parent);
      const lark = await this.lark({ title, content }, comment, parent);

      if (
        [wechat, qq, telegram, qywxAmWechat, pushplus, discord, lark].every(
          think.isEmpty,
        )
      ) {
        mailList.push({ to: AUTHOR, title, content });
      }
    }

    const disallowList = ['github', 'twitter', 'facebook', 'qq', 'weibo'].map(
      (social) => 'mail.' + social,
    );
    const fakeMail = new RegExp(`@(${disallowList.join('|')})$`, 'i');

    if (
      parent &&
      !fakeMail.test(parent.mail) &&
      !isCommentSelf &&
      !isReplyAuthor &&
      comment.status !== 'waiting'
    ) {
      mailList.push({
        to: parent.mail,
        title: mailSubject || 'MAIL_SUBJECT',
        content: mailTemplate || 'MAIL_TEMPLATE',
      });
    }

    for (const mail of mailList) {
      try {
        const response = await this.mail(mail, comment, parent);

        console.log('Notification mail send success: %s', response);
      } catch (e) {
        console.log('Mail send fail:', e);
      }
    }
  }
};
