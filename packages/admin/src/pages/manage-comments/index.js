import React, { useEffect, useReducer, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import cls from 'classnames';
import Header from '../../components/Header';
import {
  deleteComment,
  getCommentList,
  replyComment,
  updateComment,
} from '../../services/comment';
import Paginator from '../../components/Paginator';
import { buildAvatar, getPostUrl, formatDate } from './utils';
import { useTranslation, Trans } from 'react-i18next';

const FILTERS = [
  [
    'owner',
    [
      { type: 'all', name: <Trans i18nKey="all"></Trans> },
      { type: 'mine', name: <Trans i18nKey="mine"></Trans> },
    ],
  ],
  [
    'status',
    [
      { type: 'approved', name: <Trans i18nKey="approved"></Trans> },
      { type: 'waiting', name: <Trans i18nKey="waiting"></Trans> },
      { type: 'spam', name: <Trans i18nKey="spam"></Trans> },
    ],
  ],
];

export default function () {
  const { t } = useTranslation();
  const keywordRef = useRef(null);
  const replyTextAreaRef = useRef(null);
  const editCommentRef = useRef({});
  const user = useSelector((state) => state.user);
  const [list, setList] = useState({
    page: 1,
    totalPages: 0,
    spamCount: 0,
    waitingCount: 0,
    data: [],
  });
  const [filter, dispatch] = useReducer(
    function (state, action) {
      return { ...state, ...action };
    },
    { owner: 'all', status: 'approved', keyword: '' }
  );
  const [cmtHandler, setCmtHandler] = useState({});
  const [actDropStatus, setActDropStatus] = useState(false);
  const [commentIds, setCommentIds] = useState([]);

  useEffect(() => {
    getCommentList({ page: list.page, filter }).then((data) => {
      setList({ ...list, ...data });
      setCommentIds([]);
    });
  }, [filter, list.page]);

  const createActions = (comment) =>
    [
      {
        key: 'approved',
        name: t('approved button'),
        show: true,
        disable: comment && comment.status === 'approved',
        async action() {
          if (comment) {
            await updateComment(comment.objectId, { status: 'approved' });
            list.data = list.data.filter(
              ({ objectId }) => objectId !== comment.objectId
            );
            switch (comment.status) {
              case 'waiting':
                list.waitingCount -= 1;
                break;
              case 'spam':
                list.spamCount -= 1;
                break;
            }
            setList({ ...list });
          } else {
            await Promise.all(
              commentIds.map((objectId) =>
                updateComment(objectId, { status: 'approved' })
              )
            );
            getCommentList({ page: list.page, filter }).then((data) => {
              setList({ ...list, ...data });
              setCommentIds([]);
            });
          }
        },
      },
      {
        key: 'waiting',
        name: t('waiting'),
        show: true,
        disable: comment && comment.status === 'waiting',
        async action() {
          if (comment) {
            await updateComment(comment.objectId, { status: 'waiting' });
            list.data = list.data.filter(
              ({ objectId }) => objectId !== comment.objectId
            );
            if (comment.status === 'spam') {
              list.spamCount -= 1;
            }
            list.waitingCount += 1;
            setList({ ...list });
          } else {
            await Promise.all(
              commentIds.map((objectId) =>
                updateComment(objectId, { status: 'waiting' })
              )
            );
            getCommentList({ page: list.page, filter }).then((data) => {
              setList({ ...list, ...data });
              setCommentIds([]);
            });
          }
        },
      },
      {
        key: 'spam',
        show: true,
        name: comment ? t('spam') : t('mark as spam'),
        disable: comment && comment.status === 'spam',
        async action() {
          if (comment) {
            await updateComment(comment.objectId, { status: 'spam' });
            list.data = list.data.filter(
              ({ objectId }) => objectId !== comment.objectId
            );
            list.spamCount += 1;
            setList({ ...list });
          } else {
            await Promise.all(
              commentIds.map((objectId) =>
                updateComment(objectId, { status: 'spam' })
              )
            );
            getCommentList({ page: list.page, filter }).then((data) => {
              setList({ ...list, ...data });
              setCommentIds([]);
            });
          }
        },
      },
      {
        key: 'sticky',
        show: comment && !comment.rid && comment.status === 'approved',
        name: comment && comment.sticky ? t('disable sticky') : t('sticky'),
        async action(e) {
          e.preventDefault();

          const sticky = !comment.sticky;
          list.data.forEach((cmt) => {
            if (cmt.objectId === comment.objectId) {
              cmt.sticky = sticky;
            }
          });
          await updateComment(comment.objectId, { sticky });
          setList({ ...list });
        },
      },
      {
        key: 'edit',
        show: comment,
        name: t('edit'),
        action() {
          const handler = {};
          if (
            cmtHandler.id !== comment.objectId &&
            cmtHandler.action !== 'edit'
          ) {
            handler.id = comment.objectId;
            handler.action = 'edit';
          }
          setCmtHandler(handler);
        },
      },
      {
        key: 'reply',
        show: comment && comment.status === 'approved',
        name: t('reply'),
        action() {
          const handler = {};
          if (
            cmtHandler.id !== comment.objectId &&
            cmtHandler.action !== 'reply'
          ) {
            handler.id = comment.objectId;
            handler.action = 'reply';
          }
          setCmtHandler(handler);
        },
      },
      {
        key: 'delete',
        name: t('delete'),
        show: true,
        async action() {
          const text = comment
            ? t('delete one confirm', { nick: comment.nick })
            : t('delete multiple confirm');
          if (!confirm(text)) {
            return;
          }

          if (comment) {
            await deleteComment(comment.objectId);
            list.data = list.data.filter(
              ({ objectId }) => objectId !== comment.objectId
            );
            setList({ ...list });
          } else {
            await Promise.all(commentIds.map(deleteComment));
            getCommentList({ page: list.page, filter }).then((data) => {
              setList({ ...list, ...data });
              setCommentIds([]);
            });
          }
        },
      },
    ].filter(({ show }) => show);

  const cmtReply = async ({ pid, rid, url, at }) => {
    const comment = replyTextAreaRef.current.value;
    if (!comment) {
      return null;
    }
    const { display_name, email, url: link } = user;
    await replyComment({
      nick: display_name,
      mail: email,
      ua: navigator.userAgent,
      link,
      url,
      comment,
      pid,
      rid: rid || pid,
      at,
    });
    location.reload();
    // setCmtHandler({});
    // setList({page: 1, totalPages: list.totalPages, spamCount: list.spamCount, data: []});
  };

  const onEditComment = async (idx) => {
    const comment = list.data[idx];
    await updateComment(comment.objectId, editCommentRef.current);
    list.data[idx] = { ...comment, ...editCommentRef.current };
    setList({ ...list });
    setCmtHandler({});
  };

  const allSelected =
    list.data.length &&
    list.data.every(({ objectId }) => commentIds.includes(objectId));
  return (
    <>
      <Header />
      <div className="main">
        <div className="body container">
          <div className="typecho-page-title">
            <h2>{t('manage comments')}</h2>
          </div>
          <div className="row typecho-page-main" role="main">
            <div className="col-mb-12 typecho-list">
              <div className="clearfix">
                {FILTERS.map(([key, FILTER]) => (
                  <ul
                    key={key}
                    className={cls('typecho-option-tabs', {
                      right: key === 'owner',
                    })}
                  >
                    {FILTER.map(({ type, name }) => (
                      <li
                        className={cls({ current: type === filter[key] })}
                        key={type}
                      >
                        <a href="#" onClick={() => dispatch({ [key]: type })}>
                          {name}
                          {key === 'status' &&
                          type !== 'approved' &&
                          list[`${type}Count`] > 0 ? (
                            <span className="balloon">
                              {list[`${type}Count`]}
                            </span>
                          ) : null}
                        </a>
                      </li>
                    ))}
                  </ul>
                ))}
              </div>

              <div className="typecho-list-operate clearfix">
                <form method="get">
                  <div className="operate">
                    <label>
                      <i className="sr-only">{t('select all')}</i>
                      <input
                        type="checkbox"
                        className="typecho-table-select-all"
                        checked={allSelected}
                        onChange={() =>
                          setCommentIds(
                            allSelected
                              ? []
                              : list.data.map(({ objectId }) => objectId)
                          )
                        }
                      />
                    </label>
                    <div className="btn-group btn-drop">
                      <button
                        className="btn dropdown-toggle btn-s"
                        type="button"
                        onClick={() => setActDropStatus(!actDropStatus)}
                      >
                        <i className="sr-only">{t('action')}</i>
                        {t('selected items')} <i className="i-caret-down"></i>
                      </button>
                      <ul
                        className="dropdown-menu"
                        style={{ display: actDropStatus ? 'block' : 'none' }}
                        onClick={() => setActDropStatus(false)}
                      >
                        {createActions().map(({ key, name, action }) => (
                          <li key={key}>
                            <a href="#" onClick={action}>
                              {name}
                            </a>
                          </li>
                        ))}
                      </ul>
                      &nbsp;
                      {/* {filter.status === 'spam' ? (
                      <button lang="你确认要删除所有垃圾评论吗?" className="btn btn-s btn-warn btn-operate">删除所有垃圾评论</button>
                    ) : null} */}
                    </div>
                  </div>

                  <div className="search" role="search">
                    <input
                      type="text"
                      ref={keywordRef}
                      className="text-s"
                      placeholder={t('please input keywords')}
                    />
                    &nbsp;
                    <button
                      type="submit"
                      className="btn btn-s"
                      onClick={(e) => {
                        e.preventDefault();
                        dispatch({ keyword: keywordRef.current.value });
                      }}
                    >
                      {t('filter')}
                    </button>
                  </div>
                </form>
              </div>

              <form
                method="post"
                name="manage_comments"
                className="operate-form"
              >
                <div className="typecho-table-wrap">
                  <table className="typecho-list-table">
                    <colgroup>
                      <col width="3%" />
                      <col width="6%" />
                      <col width="20%" />
                      <col width="71%" />
                    </colgroup>
                    <thead>
                      <tr>
                        <th> </th>
                        <th>{t('author')}</th>
                        <th> </th>
                        <th>{t('content')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.data.map(
                        (
                          {
                            objectId,
                            nick,
                            mail,
                            link,
                            comment,
                            ip,
                            url,
                            status,
                            rid,
                            pid,
                            sticky,
                            insertedAt,
                          },
                          idx
                        ) =>
                          cmtHandler.id === objectId &&
                          cmtHandler.action === 'edit' ? (
                            <tr className="comment-edit" key={objectId}>
                              <td> </td>
                              <td colSpan="2" valign="top">
                                <div className="comment-edit-info">
                                  <p>
                                    <label
                                      htmlFor={`comment-${objectId}-author`}
                                    >
                                      {t('username')}
                                    </label>
                                    <input
                                      className="text-s w-100"
                                      id={`comment-${objectId}-author`}
                                      name="author"
                                      type="text"
                                      defaultValue={nick}
                                      onChange={(e) =>
                                        (editCommentRef.current.nick =
                                          e.target.value)
                                      }
                                    />
                                  </p>
                                  <p>
                                    <label htmlFor={`comment-${objectId}-mail`}>
                                      {t('email')}
                                    </label>
                                    <input
                                      className="text-s w-100"
                                      type="email"
                                      name="mail"
                                      id={`comment-${objectId}-mail`}
                                      defaultValue={mail}
                                      onChange={(e) =>
                                        (editCommentRef.current.mail =
                                          e.target.value)
                                      }
                                    />
                                  </p>
                                  <p>
                                    <label htmlFor={`comment-${objectId}-url`}>
                                      {t('homepage')}
                                    </label>
                                    <input
                                      className="text-s w-100"
                                      type="text"
                                      name="url"
                                      id={`comment-${objectId}-author`}
                                      defaultValue={link}
                                      onChange={(e) =>
                                        (editCommentRef.current.link =
                                          e.target.value)
                                      }
                                    />
                                  </p>
                                </div>
                              </td>
                              <td valign="top">
                                <div className="comment-edit-content">
                                  <p>
                                    <label htmlFor={`comment-${objectId}-text`}>
                                      {t('content')}
                                    </label>
                                    <textarea
                                      name="text"
                                      id={`comment-${objectId}-text`}
                                      rows="6"
                                      className="w-90 mono"
                                      defaultValue={comment}
                                      onChange={(e) =>
                                        (editCommentRef.current.comment =
                                          e.target.value)
                                      }
                                    />
                                  </p>
                                  <p>
                                    <button
                                      type="button"
                                      className="btn btn-s primary"
                                      onClick={() => onEditComment(idx)}
                                    >
                                      {t('submit')}
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-s cancel"
                                      onClick={() => setCmtHandler({})}
                                    >
                                      {t('cancel')}
                                    </button>
                                  </p>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            <tr id={`comment-${objectId}`} key={objectId}>
                              <td valign="top">
                                <input
                                  type="checkbox"
                                  value={objectId}
                                  checked={commentIds.includes(objectId)}
                                  onChange={() =>
                                    setCommentIds(
                                      commentIds.includes(objectId)
                                        ? commentIds.filter(
                                            (id) => id !== objectId
                                          )
                                        : [...commentIds, objectId]
                                    )
                                  }
                                />
                              </td>
                              <td valign="top">
                                <div className="comment-avatar">
                                  <img
                                    className="avatar"
                                    src={buildAvatar(mail)}
                                    alt={nick}
                                    width="40"
                                    height="40"
                                  />
                                </div>
                              </td>
                              <td valign="top" className="comment-head">
                                <div className="comment-meta">
                                  <strong className="comment-author">
                                    <a
                                      href={
                                        !/^https:\/\//.test(link)
                                          ? 'https://' + link
                                          : link
                                      }
                                      rel="external nofollow noreferrer"
                                      target="_blank"
                                    >
                                      {nick}
                                    </a>
                                  </strong>
                                  <br />
                                  <span>
                                    <a
                                      href={`mailto:${mail}`}
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      {mail}
                                    </a>
                                  </span>
                                  <br />
                                  <span>{ip}</span>
                                </div>
                              </td>
                              <td valign="top" className="comment-body">
                                <div className="comment-date">
                                  {formatDate(insertedAt)} {t('at')}{' '}
                                  <a
                                    href={getPostUrl(url)}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    {url}
                                  </a>
                                </div>
                                <div
                                  className="comment-content"
                                  dangerouslySetInnerHTML={{ __html: comment }}
                                ></div>
                                {cmtHandler.id === objectId &&
                                cmtHandler.action === 'reply' ? (
                                  <form className="comment-reply">
                                    <p>
                                      <label htmlFor="text" className="sr-only">
                                        {t('content')}
                                      </label>
                                      <textarea
                                        id="text"
                                        name="text"
                                        className="w-90 mono"
                                        rows="3"
                                        ref={replyTextAreaRef}
                                      ></textarea>
                                    </p>
                                    <p>
                                      <button
                                        type="button"
                                        className="btn btn-s primary"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          cmtReply({
                                            rid,
                                            pid: objectId,
                                            url,
                                            at: nick,
                                          });
                                        }}
                                      >
                                        {t('reply')}
                                      </button>{' '}
                                      &nbsp;
                                      <button
                                        type="button"
                                        className="btn btn-s cancel"
                                        onClick={() => setCmtHandler({})}
                                      >
                                        {t('cancel')}
                                      </button>
                                    </p>
                                  </form>
                                ) : null}
                                <div className="comment-action hidden-by-mouse">
                                  {createActions({
                                    objectId,
                                    nick,
                                    status,
                                    rid,
                                    pid,
                                    sticky,
                                  }).map(({ key, disable, name, action }) =>
                                    disable ? (
                                      <span className="weak" key={key}>
                                        {name}
                                      </span>
                                    ) : (
                                      <a
                                        key={key}
                                        href="#"
                                        className={`operate-${key}`}
                                        onClick={action}
                                      >
                                        {name}
                                      </a>
                                    )
                                  )}
                                </div>
                              </td>
                            </tr>
                          )
                      )}
                    </tbody>
                  </table>
                </div>
              </form>

              <div className="typecho-list-operate clearfix">
                <form method="get">
                  <Paginator
                    current={list.page}
                    total={list.totalPages}
                    onChange={(page) => setList({ ...list, page })}
                  />
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
