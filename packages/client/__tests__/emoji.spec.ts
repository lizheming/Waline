import { parseEmojiPre, parseEmojiAfter } from '../src/utils/markdown';
import { emojiMaps } from './utils';

describe('Emoji test', () => {
  it('Should not parse', () => {
    const content = 'Waline is a good framework. Note: It works with backend';

    expect(parseEmojiAfter(parseEmojiPre(content, emojiMaps))).toEqual(content);
  });

  it("Should not parse emoji it don't know", () => {
    const content = 'Waline is a good framework. :heart:';

    expect(parseEmojiAfter(parseEmojiPre(content, emojiMaps))).toEqual(content);
  });

  it('Should parse emoji', () => {
    expect(
      parseEmojiAfter(
        parseEmojiPre('Waline is a good framework. :bb_doge:', emojiMaps)
      )
    ).toEqual(
      'Waline is a good framework. <img class="vemoji" src="https://cdn.jsdelivr.net/gh/walinejs/emojis/bilibili/bb_doge.png" alt="bb_doge">'
    );
  });

  it('Should not throw errows', () => {
    expect(parseEmojiPre());
    expect(parseEmojiPre(''));
    expect(parseEmojiAfter());
    expect(parseEmojiAfter(''));
  });
});
