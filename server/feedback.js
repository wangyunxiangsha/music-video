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
  ],
  notVibe: [
    '\u8fd9\u9996\u4e0d\u5bf9\u5473',
    '\u4e0d\u5bf9\u5473',
    '\u73b0\u5728\u4e0d\u60f3\u542c\u8fd9\u9996',
    '\u4e0d\u592a\u5408\u9002\u73b0\u5728'
  ],
  sceneReduceTrack: [
    '\u8fd9\u4e2a\u573a\u666f\u522b\u653e\u8fd9\u9996',
    '\u5f53\u524d\u573a\u666f\u522b\u653e\u8fd9\u9996',
    '\u8fd9\u4e2a\u6a21\u5f0f\u522b\u653e\u8fd9\u9996',
    '\u5f53\u524d\u6a21\u5f0f\u522b\u653e\u8fd9\u9996',
    '\u8fd9\u4e2a\u573a\u666f\u4e0d\u9002\u5408',
    '\u5f53\u524d\u6a21\u5f0f\u4e0d\u9002\u5408'
  ],
  sceneBoostTrack: [
    '\u8fd9\u4e2a\u573a\u666f\u9002\u5408\u8fd9\u9996',
    '\u5f53\u524d\u573a\u666f\u9002\u5408\u8fd9\u9996',
    '\u8fd9\u4e2a\u6a21\u5f0f\u9002\u5408\u8fd9\u9996',
    '\u5f53\u524d\u6a21\u5f0f\u9002\u5408\u8fd9\u9996',
    '\u8fd9\u9996\u5f88\u9002\u5408\u8fd9\u4e2a\u573a\u666f',
    '\u8fd9\u9996\u5f88\u9002\u5408\u5f53\u524d\u6a21\u5f0f'
  ]
};

function includesAny(text, words) {
  return words.some(word => text.includes(word));
}

function currentArtist(track) {
  return track?.artists?.[0]?.name || track?.ar?.[0]?.name || '';
}

function parseFeedback(message, currentTrack, context = {}) {
  const text = String(message || '').trim();
  if (!text || !currentTrack) return null;

  const artist = currentArtist(currentTrack);
  const category = currentTrack?.categoryName || '';
  const scene = context.scene || null;

  if (scene && includesAny(text, WORDS.sceneReduceTrack)) {
    return {
      type: 'scene_reduce',
      target: 'track',
      track: currentTrack,
      scene,
      reply: `\u6536\u5230\uff0c\u300c${scene.name || '\u5f53\u524d\u573a\u666f'}\u300d\u91cc\u4f1a\u5c11\u5b89\u6392\u8fd9\u9996\u3002`
    };
  }

  if (scene && includesAny(text, WORDS.sceneBoostTrack)) {
    return {
      type: 'scene_boost',
      target: 'track',
      track: currentTrack,
      scene,
      reply: `\u8bb0\u4f4f\u4e86\uff0c\u300c${scene.name || '\u5f53\u524d\u573a\u666f'}\u300d\u91cc\u8fd9\u9996\u662f\u52a0\u5206\u9879\u3002`
    };
  }

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

  if (includesAny(text, WORDS.notVibe)) {
    return {
      type: 'not_vibe',
      target: 'track',
      track: currentTrack,
      temporary: true,
      reply: '\u660e\u767d\uff0c\u8fd9\u9996\u4e0d\u662f\u8ba8\u538c\uff0c\u53ea\u662f\u4eca\u5929\u5148\u5c11\u5b89\u6392\u8fd9\u4e2a\u65b9\u5411\u3002'
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
