require('dotenv').config();
const axios = require('axios');

const AMAP_KEY = process.env.AMAP_WEATHER_KEY || '';
const AMAP_CITY = process.env.AMAP_WEATHER_CITY || '320100';
const OPENWEATHER_KEY = process.env.OPENWEATHER_API_KEY || '';
const OPENWEATHER_CITY = process.env.WEATHER_CITY || 'Nanjing,CN';
const OPENWEATHER_UNITS = process.env.WEATHER_UNITS || 'metric';
const OPENWEATHER_LANG = process.env.WEATHER_LANG || 'zh_cn';
const CACHE_TTL_MS = 20 * 60 * 1000;

let cache = { at: 0, text: '' };

function setCache(text) {
  cache = { at: Date.now(), text };
  return text;
}

async function getAmapWeatherText() {
  if (!AMAP_KEY) return '';
  const res = await axios.get('https://restapi.amap.com/v3/weather/weatherInfo', {
    params: {
      key: AMAP_KEY,
      city: AMAP_CITY,
      extensions: 'base',
      output: 'JSON'
    },
    timeout: 5000
  });
  if (res.data?.status !== '1') {
    throw new Error(res.data?.info || '高德天气接口返回异常');
  }
  const live = res.data?.lives?.[0];
  if (!live) return '';
  const city = live.city || AMAP_CITY;
  const weather = live.weather || '';
  const temp = live.temperature ? `${live.temperature}°C` : '';
  return [city, weather, temp].filter(Boolean).join('，');
}

async function getOpenWeatherText() {
  if (!OPENWEATHER_KEY) return '';
  const res = await axios.get('https://api.openweathermap.org/data/2.5/weather', {
    params: {
      q: OPENWEATHER_CITY,
      appid: OPENWEATHER_KEY,
      units: OPENWEATHER_UNITS,
      lang: OPENWEATHER_LANG
    },
    timeout: 5000
  });
  const desc = res.data?.weather?.[0]?.description || '';
  const temp = Math.round(res.data?.main?.temp);
  const city = res.data?.name || OPENWEATHER_CITY;
  return `${city}，${desc}，${temp}°C`;
}

async function getWeatherText() {
  if (!AMAP_KEY && !OPENWEATHER_KEY) return '';
  if (cache.text && Date.now() - cache.at < CACHE_TTL_MS) return cache.text;

  try {
    const amapText = await getAmapWeatherText();
    if (amapText) return setCache(amapText);
  } catch (e) {
    console.warn('Amap weather fetch error:', e.message);
  }

  try {
    const openWeatherText = await getOpenWeatherText();
    if (openWeatherText) return setCache(openWeatherText);
  } catch (e) {
    console.warn('OpenWeather fetch error:', e.message);
  }

  return '';
}

module.exports = {
  getWeatherText,
  getAmapWeatherText,
  getOpenWeatherText
};
