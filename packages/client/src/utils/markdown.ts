import hanabi from 'hanabi';
import marked from 'marked';

import type { EmojiMaps } from '../config';

const inlineMathRegExp = /\B\$([^\s$]|[^\s$][^\n$]*[^\s$])\$\B/g;
const blockMathRegExp = /(^|\n)\$\$(.+?)\$\$(\n|$)/gs;

export const parseEmojiPre = (text = '', emojiMap: EmojiMaps = {}): string =>
  text.replace(/:(.+?):/g, (placeholder, key: string) =>
    emojiMap[key]
      ? `:<img class="vemoji" src="${emojiMap[key]}" alt="${key}">:`
      : placeholder
  );

export const parseEmojiAfter = (content = ''): string =>
  content.replace(/:(<img class="vemoji" [^>]+>):/g, '$1');

export const parseMath = (content: string): string =>
  content
    .replace(
      blockMathRegExp,
      '<p class="vtex">Tex is not available in preview</p>'
    )
    .replace(
      inlineMathRegExp,
      '<span class="vtex">Tex is not available in preview</span>'
    );

export const parseMarkdown = (
  content: string,
  highlight = true,
  emojiMap: EmojiMaps
): string => {
  marked.setOptions({
    highlight: highlight ? hanabi : undefined,
    breaks: true,
    smartLists: true,
    smartypants: true,
  });

  return parseEmojiAfter(marked(parseMath(parseEmojiPre(content, emojiMap))));
};
