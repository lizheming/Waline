import { Store, useStore } from '../composables/store';
import { removeEndingSplash } from './path';

import type { EmojiConfig } from './config';
import type { WalineEmojiInfo } from '../typings';

let store: Store;

const hasVersion = (url: string): boolean =>
  Boolean(/@[0-9]+\.[0-9]+\.[0-9]+/.test(url));

const fetchEmoji = (link: string): Promise<WalineEmojiInfo> => {
  if (!store) store = useStore('WALINE_EMOJI');

  const result = hasVersion(link);

  if (result) {
    const info = store.get<WalineEmojiInfo>(link);
    if (info) return Promise.resolve(info);
  }

  return fetch(`${link}/info.json`)
    .then((resp) => resp.json() as Promise<Omit<WalineEmojiInfo, 'folder'>>)
    .then((emojiInfo) => {
      const info = {
        folder: link,
        ...emojiInfo,
      };

      if (result) store.set(link, info);

      return info;
    });
};

const getLink = (
  name: string,
  folder: string,
  prefix = '',
  type = ''
): string => `${folder}/${prefix}${name}${type ? `.${type}` : ''}`;

export const getEmojis = (
  emojis: (string | WalineEmojiInfo)[]
): Promise<EmojiConfig> =>
  Promise.all(
    emojis.map((emoji) =>
      typeof emoji === 'string'
        ? fetchEmoji(removeEndingSplash(emoji))
        : Promise.resolve(emoji)
    )
  ).then((emojiInfos) => {
    const emojiConfig: EmojiConfig = {
      tabs: [],
      map: {},
    };

    emojiInfos.forEach((emojiInfo) => {
      const { name, folder, icon, prefix, type, items } = emojiInfo;

      emojiConfig.tabs.push({
        name,
        icon: getLink(icon, folder, prefix, type),
        items: items.map((item) => {
          const key = `${prefix || ''}${item}`;

          emojiConfig.map[key] = getLink(item, folder, prefix, type);

          return key;
        }),
      });
    });

    return emojiConfig;
  });
