const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');

const VOICE = process.env.TTS_VOICE || 'zh-CN-YunyangNeural';
const TTS_RATE = Number(process.env.TTS_RATE || 0.86);
const TTS_PITCH = process.env.TTS_PITCH || '-8Hz';
const TTS_VOLUME = process.env.TTS_VOLUME || '+0%';

async function synthesize(text) {
  const edgeTTS = new MsEdgeTTS();
  await edgeTTS.setMetadata(VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

  return new Promise((resolve, reject) => {
    const { audioStream } = edgeTTS.toStream(text, {
      rate: TTS_RATE,
      pitch: TTS_PITCH,
      volume: TTS_VOLUME
    });
    const chunks = [];

    audioStream.on('data',  (chunk) => chunks.push(chunk));
    audioStream.on('end',   () => resolve(Buffer.concat(chunks)));
    audioStream.on('error', reject);

    setTimeout(() => {
      if (chunks.length > 0) resolve(Buffer.concat(chunks));
      else reject(new Error('Edge TTS timeout'));
    }, 15000);
  });
}

module.exports = { synthesize };
