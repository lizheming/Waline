import { fetchUserList, WalineUser } from '../api';
import { defaultLang, defaultLocales } from '../config';
import { WalineLocale } from '../typings';
import { getRoot } from '../utils';

export interface WalineUserListOptions {
  /**
   * Waline 服务端地址
   *
   * Waline serverURL
   */
  serverURL: string;

  /**
   * 获取用户列表的数量
   *
   * fetch number of user list
   */
  count: number;

  /**
   * 需要挂载的元素
   *
   * Element to be mounted
   */
  el?: string | HTMLElement;

  /**
   * 错误提示消息所使用的语言
   *
   * Language of error message
   *
   * @default 'zh-CN'
   */
  lang?: string;

  /**
   * 自定义 waline 语言显示
   *
   * @see [自定义语言](https://waline.js.org/client/i18n.html)
   *
   * Custom display language in waline
   *
   * @see [I18n](https://waline.js.org/en/client/i18n.html)
   */
  locale?: WalineLocale;
}

export interface WalineUserListResult {
  /**
   * 用户数据
   *
   * User Data
   */
  users: WalineUser[];

  /**
   * 取消挂载挂件
   *
   * Umount widget
   */
  destroy: () => void;
}

export const UserList = ({
  el,
  serverURL,
  count,
  locale,
  lang = defaultLang,
}: WalineUserListOptions): Promise<WalineUserListResult> => {
  const root = getRoot(el);
  const controller = new AbortController();

  return fetchUserList({
    serverURL,
    pageSize: count,
    lang,
    signal: controller.signal,
  }).then((users) => {
    if (!root || !users.length) {
      return {
        users,
        destroy: (): void => controller.abort(),
      };
    }

    locale = {
      ...(defaultLocales[lang] || defaultLocales[defaultLang]),
      ...(typeof locale === 'object' ? locale : {}),
    } as WalineLocale;

    root.innerHTML = `<ul class="wl-user-list">${users
      .map((user, index) =>
        [
          '<li class="wl-user-item">',
          user.link && `<a href="${user.link}" target="_blank">`,
          '<div class="wl-user-avatar">',
          `<img src="${user.avatar}" alt="${user.nick}">`,
          `<i>${index + 1}</i>`,
          '</div>',
          '<div class="wl-user-meta">',
          `<div class="wl-user-name"><div>${user.nick}</div>`,
          '<div class="wl-user-tag wl-card">',
          user.level &&
            `<span class="wl-badge">${
              locale ? locale[`level${user.level}`] : `Level ${user.level}`
            }</span>`,
          user.label && `<span class="wl-badge">${user.label}</span>`,
          '</div>',
          '</div>',
          user.link && `<span class="wl-user-meta">${user.link}</span>`,
          '</div>',
          user.link && '</a>',
          '</li>',
        ]
          .filter((v) => v)
          .join('')
      )
      .join('')}</ul>`;

    console.log(root, root.innerHTML);

    return {
      users,
      destroy: (): void => {
        controller.abort();
        root.innerHTML = '';
      },
    };
  });
};
