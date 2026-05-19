'use strict';

const WORDS = {
  likeTrack: [
    '\u559c\u6b22\u8fd9\u9996',
    '\u8fd9\u9996\u4e0d\u9519',
    '\u597d\u542c',
    '\u591a\u653e\u8fd9\u9996'
  ],
  dislikeTrack: [
    '\u4e0d\u559c\u6b22\u8fd9\u9996',
    '\u522b\u653e\u8fd9\u9996',
    '\u8df3\u8fc7\u8fd9\u9996',
    '\u8fd9\u9996\u4e0d\u597d\u542c',
    '\u5c11\u653e\u8fd9\u9996'
  ],
  boostArtist: [
    '\u591a\u653e\u8fd9\u4e2a\u6b4c\u624b',
    '\u591a\u653e\u8fd9\u4e2a\u4eba',
    '\u591a\u6765\u70b9\u8fd9\u4e2a\u6b4c\u624b'
  ],
  reduceArtist: [
    '\u5c11\u653e\u8fd9\u4e2a\u6b4c\u624b',
    '\u522b\u653e\u8fd9\u4e2a\u6b4c\u624b',
    '\u4e0d\u60f3\u542c\u8fd9\u4e2a\u6b4c\u624b'
  ],
  blockCategory: [
    '\u522b\u653e\u8fd9\u7c7b',
    '\u5c11\u653e\u8fd9\u79cd',
    '\u4e0d\u60f3\u542c\u8fd9\u79cd'
  ]
};

function includesAny(text, words) {
  return words.some(word => text.includes(word));
}

function currentArtist(track) {
  return track?.artists?.[0]?.name || track?.ar?.[0]?.name || '';
}

function parseFeedback(message, currentTrack) {
  const text = String(message || '').trim();
  if (!text || !currentTrack) return null;

  const artist = currentArtist(currentTrack);
  const category = currentTrack?.categoryName || '';

  if (includesAny(text, WORDS.likeTrack)) {
    return {
      type: 'like',
      target: 'track',
      track: currentTrack,
      reply: '\u6536\u5230\uff0c\u8fd9\u9996\u4f1a\u8bb0\u8fdb\u4f60\u7684\u504f\u597d\u91cc\u3002'
    };
  }

  if (includesAny(text, WORDS.dislikeTrack)) {
    return {
      type: 'dislike',
      target: 'track',
      track: currentTrack,
      reply: '\u597d\uff0c\u8fd9\u9996\u4ee5\u540e\u4f1a\u5c11\u51fa\u73b0\u3002'
    };
  }

  if (includesAny(text, WORDS.boostArtist)) {
    if (!artist) return null;
    return {
      type: 'boost',
      target: 'artist',
      value: artist,
      track: currentTrack,
      reply: `\u8bb0\u4f4f\u4e86\uff0c\u4ee5\u540e\u591a\u653e ${artist}\u3002`
    };
  }

  if (includesAny(text, WORDS.reduceArtist)) {
    if (!artist) return null;
    return {
      type: 'reduce',
      target: 'artist',
      value: artist,
      track: currentTrack,
      reply: `\u597d\uff0c\u4e4b\u540e\u4f1a\u5c11\u653e ${artist}\u3002`
    };
  }

  if (includesAny(text, WORDS.blockCategory)) {
    if (!category) return null;
    return {
      type: 'block',
      target: 'category',
      value: category,
      track: currentTrack,
      reply: `\u6536\u5230\uff0c\u4e4b\u540e\u4f1a\u907f\u5f00\u300c${category}\u300d\u3002`
    };
  }

  return null;
}

module.exports = { parseFeedback };
