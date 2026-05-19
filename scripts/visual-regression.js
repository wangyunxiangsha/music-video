/* eslint-disable no-console */
const fs = require('fs');
const http = require('http');
const path = require('path');
const zlib = require('zlib');

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  console.error('缺少 Playwright。请先运行：npm install');
  console.error('然后执行：npm run test:visual');
  process.exit(1);
}

const ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const OUT_DIR = path.join(ROOT, 'data', 'screenshots');

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'mobile', width: 390, height: 844 }
];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml; charset=utf-8'
};

function mockTrack() {
  return {
    id: 'visual-regression',
    name: '黄昏',
    artists: [{ name: '周传雄' }],
    album: { name: 'Claudio Visual Test', picUrl: '' },
    privilege: { pl: 1 }
  };
}

function startServer() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname === '/api/now') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({
        track: mockTrack(),
        djMessage: '夜色正好，听一首黄昏，慢慢落下来。',
        weather: '北京市，阴，22°C',
        next: null
      }));
      return;
    }
    if (url.pathname === '/api/music/stream/visual-regression') {
      res.statusCode = 404;
      res.end('visual test skips real audio');
      return;
    }
    if (url.pathname === '/stream') {
      res.statusCode = 426;
      res.end('websocket disabled in visual test');
      return;
    }

    const safePath = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const filePath = path.normalize(path.join(PUBLIC_DIR, safePath));
    if (!filePath.startsWith(PUBLIC_DIR)) {
      res.statusCode = 403;
      res.end('forbidden');
      return;
    }
    fs.readFile(filePath, (err, body) => {
      if (err) {
        res.statusCode = 404;
        res.end('not found');
        return;
      }
      res.setHeader('Content-Type', MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream');
      res.end(body);
    });
  });

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, port: server.address().port });
    });
  });
}

function parsePng(buffer) {
  const signature = '89504e470d0a1a0a';
  if (buffer.subarray(0, 8).toString('hex') !== signature) throw new Error('not a PNG');
  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  const idat = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString('ascii');
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colorType = data[9];
      if (data[8] !== 8) throw new Error('unsupported PNG bit depth');
      if (colorType !== 2 && colorType !== 6) throw new Error('unsupported PNG color type');
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
  }
  const channels = colorType === 6 ? 4 : 3;
  const stride = width * channels;
  const inflated = zlib.inflateSync(Buffer.concat(idat));
  const pixels = Buffer.alloc(width * height * channels);
  let inOffset = 0;
  let outOffset = 0;
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = inflated[inOffset++];
    const row = Buffer.from(inflated.subarray(inOffset, inOffset + stride));
    inOffset += stride;
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? row[x - channels] : 0;
      const up = prev[x] || 0;
      const upLeft = x >= channels ? prev[x - channels] : 0;
      if (filter === 1) row[x] = (row[x] + left) & 255;
      else if (filter === 2) row[x] = (row[x] + up) & 255;
      else if (filter === 3) row[x] = (row[x] + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) row[x] = (row[x] + paeth(left, up, upLeft)) & 255;
      else if (filter !== 0) throw new Error(`unsupported PNG filter ${filter}`);
    }
    row.copy(pixels, outOffset);
    outOffset += stride;
    prev = row;
  }
  return { width, height, channels, pixels };
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function assertScreenshotNonBlank(filePath) {
  const png = parsePng(fs.readFileSync(filePath));
  const seen = new Set();
  const step = Math.max(1, Math.floor((png.width * png.height) / 5000));
  for (let pixel = 0; pixel < png.width * png.height; pixel += step) {
    const i = pixel * png.channels;
    seen.add(`${png.pixels[i]},${png.pixels[i + 1]},${png.pixels[i + 2]}`);
    if (seen.size > 24) return;
  }
  throw new Error(`${path.basename(filePath)} looks blank or nearly monochrome`);
}

function intersects(a, b) {
  return a && b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

async function assertLayout(page, state, viewportName) {
  const result = await page.evaluate((expectedState) => {
    const box = (selector) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        selector,
        left: r.left,
        top: r.top,
        right: r.right,
        bottom: r.bottom,
        width: r.width,
        height: r.height,
        display: cs.display,
        visibility: cs.visibility,
        opacity: Number(cs.opacity)
      };
    };
    return {
      state: expectedState,
      app: box('#app'),
      header: box('.header'),
      brand: box('.brand'),
      timebox: box('.timebox'),
      weather: box('#header-weather'),
      hero: box('.hero-panel'),
      heroTime: box('#hero-time'),
      melody: box('.melody-stage'),
      waveform: box('.waveform'),
      deck: box('.deck'),
      djBox: box('.dj-box'),
      command: box('.command-row'),
      footer: box('footer'),
      weatherText: document.querySelector('#header-weather')?.textContent || '',
      appHasPlaying: document.querySelector('#app')?.classList.contains('playing') || false
    };
  }, state);

  const failures = [];
  const visible = (b) => b && b.display !== 'none' && b.visibility !== 'hidden' && b.opacity > 0.05 && b.width > 2 && b.height > 2;

  if (!visible(result.app)) failures.push('app is not visible');
  if (!visible(result.header)) failures.push('header is not visible');
  if (!visible(result.hero)) failures.push('hero panel is not visible');
  if (!visible(result.deck)) failures.push('deck is not visible');
  if (!visible(result.djBox)) failures.push('DJ box is not visible');
  if (!visible(result.command)) failures.push('command row is not visible');
  if (!visible(result.footer)) failures.push('footer is not visible');
  if (!result.weatherText.includes('北京市') || !result.weatherText.includes('22°C')) failures.push('weather text is not rendered');
  if (intersects(result.brand, result.timebox)) failures.push('brand overlaps timebox');
  if (intersects(result.deck, result.djBox)) failures.push('deck overlaps DJ box');
  if (intersects(result.djBox, result.command)) failures.push('DJ box overlaps command row');
  if (intersects(result.command, result.footer)) failures.push('command row overlaps footer');

  if (state === 'playing') {
    if (!result.appHasPlaying) failures.push('app.playing class missing');
    if (!visible(result.melody)) failures.push('playing melody stage is hidden');
    if (visible(result.heroTime)) failures.push('hero time should be hidden while playing');
    if (!visible(result.waveform)) failures.push('playing waveform is hidden');
  } else {
    if (result.appHasPlaying) failures.push('app.playing class should be absent');
    if (visible(result.melody)) failures.push('paused melody stage should be hidden');
    if (!visible(result.heroTime)) failures.push('hero time should be visible while paused');
    if (visible(result.waveform)) failures.push('paused waveform should be hidden');
  }

  if (failures.length) {
    throw new Error(`${viewportName}/${state}: ${failures.join('; ')}`);
  }
}

async function captureState(page, state, viewportName) {
  await page.evaluate((targetState) => {
    const app = document.querySelector('#app');
    if (targetState === 'playing') app.classList.add('playing');
    else app.classList.remove('playing');
  }, state);
  await page.waitForTimeout(250);
  await assertLayout(page, state, viewportName);
  const filePath = path.join(OUT_DIR, `${viewportName}-${state}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  assertScreenshotNonBlank(filePath);
  return filePath;
}

async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const { server, port } = await startServer();
  const browser = await chromium.launch({ headless: true });
  const failures = [];
  const outputs = [];

  try {
    for (const viewport of VIEWPORTS) {
      const page = await browser.newPage({ viewport });
      page.on('console', (msg) => {
        const text = msg.text();
        const expectedNoise =
          text.includes('WebSocket connection') ||
          text.includes('ERR_NETWORK_ACCESS_DENIED') ||
          text.includes('404 (Not Found)');
        if (msg.type() === 'error' && !expectedNoise) {
          console.warn(`[browser:${viewport.name}] ${text}`);
        }
      });
      await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
      await page.waitForSelector('#app');
      try {
        outputs.push(await captureState(page, 'paused', viewport.name));
        outputs.push(await captureState(page, 'playing', viewport.name));
      } catch (e) {
        failures.push(e.message);
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
    server.close();
  }

  if (failures.length) {
    console.error('视觉回归检查失败：');
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log('视觉回归检查通过，截图已生成：');
  for (const file of outputs) console.log(`- ${path.relative(ROOT, file)}`);
}

run().catch((e) => {
  console.error(e.stack || e.message);
  process.exit(1);
});
