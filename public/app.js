(function () {
  'use strict';

  // ─── State ─────────────────────────────────────────────────────────────────
  const S = {
    track:         null,
    playing:       false,
    ttsEnabled:    true,
    chatOpen:      false,
    lyricOpen:     false,
    historyOpen:   false,
    lyricLines:    [],
    userRequested: false,
    queue:         null,
  };

  // ─── DOM ───────────────────────────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);

  const app       = $('app');
  const audio     = $('audio');
  const vinyl     = $('vinyl');
  const cover     = $('cover');
  const songTitle = $('song-title');
  const songArtist= $('song-artist');
  const songAlbum = $('song-album');
  const stationStatus = $('station-status');
  const clock     = $('clock');
  const headerDate = $('header-date');
  const headerWeather = $('header-weather');
  const heroTime  = $('hero-time');
  const heroDay   = $('hero-day');
  const heroDate  = $('hero-date');
  const djText    = $('dj-text');
  const fill      = $('fill');
  const tCur      = $('t-cur');
  const tEnd      = $('t-end');
  const bar       = $('bar');
  const btnPlay   = $('btn-play');
  const btnPrev   = $('btn-prev');
  const btnNext   = $('btn-next');
  const btnLike   = $('btn-like');
  const btnDislike= $('btn-dislike');
  const volSlider = $('vol');
  const volPct    = $('vol-pct');
  const chat      = $('chat');
  const chatMsgs  = $('chat-msgs');
  const quickIn   = $('quick-in');
  const quickMic  = $('quick-mic');
  const quickSend = $('quick-send');
  const btnChat   = $('btn-chat');
  const btnTts    = $('btn-tts');
  const btnLyric  = $('btn-lyric');
  const btnHistory= $('btn-history');
  const btnTaste  = $('btn-taste');
  const lyricOv   = $('lyric-overlay');
  const lyricScroll = $('lyric-scroll');
  const lyricClose  = $('lyric-close');
  const historyOv = $('history-overlay');
  const historyClose = $('history-close');
  const historyStats = $('history-stats');
  const historyArtists = $('history-artists');
  const historyCategories = $('history-categories');
  const historyList = $('history-list');
  const queueCount = $('queue-count');
  const queueList = $('queue-list');
  const queueSkip = $('queue-skip');
  const queueRebuild = $('queue-rebuild');
  const queueInsert = $('queue-insert');

  // ─── Helpers ───────────────────────────────────────────────────────────────
  function fmtTime(s) {
    if (!s || isNaN(s) || !isFinite(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  function artistOf(t) {
    return t.artists?.[0]?.name || t.ar?.[0]?.name || '未知艺术家';
  }

  function updateClock() {
    const now = new Date();
    const hh = now.getHours().toString().padStart(2, '0');
    const mm = now.getMinutes().toString().padStart(2, '0');
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const time = `${hh}:${mm}`;
    if (clock) clock.textContent = time;
    if (headerDate) headerDate.textContent = `${months[now.getMonth()]} ${String(now.getDate()).padStart(2, '0')}`;
    if (heroTime) heroTime.textContent = time;
    if (heroDay) heroDay.textContent = days[now.getDay()];
    if (heroDate) heroDate.textContent = `${String(now.getDate()).padStart(2, '0')} · ${months[now.getMonth()]} · ${now.getFullYear()}`;
  }

  function updateWeather(text) {
    if (!headerWeather) return;
    headerWeather.textContent = text || '北京天气待同步';
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[ch]));
  }

  function fmtHistoryTime(ts) {
    if (!ts) return '--';
    const d = new Date(Number(ts) * 1000);
    if (Number.isNaN(d.getTime())) return '--';
    const now = new Date();
    const sameDay = d.getFullYear() === now.getFullYear()
      && d.getMonth() === now.getMonth()
      && d.getDate() === now.getDate();
    const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    if (sameDay) return hhmm;
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
  }

  function renderHistoryStats(data) {
    const cards = [
      ['记录数', data.totalStored || 0],
      ['本次样本', data.windowCount || 0],
      ['去重歌曲', data.uniqueSongCount || 0],
      ['最近播放', fmtHistoryTime(data.lastPlayedAt)]
    ];
    historyStats.innerHTML = cards.map(([label, value]) => `
      <div class="history-stat">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
      </div>
    `).join('');
  }

  function renderHistoryBars(el, items, emptyText) {
    const list = Array.isArray(items) ? items.filter((item) => item?.name) : [];
    if (!list.length) {
      el.innerHTML = `<p class="history-empty">${escapeHtml(emptyText)}</p>`;
      return;
    }
    const max = Math.max(...list.map((item) => item.count || 0), 1);
    el.innerHTML = list.map((item) => {
      const pct = Math.max(8, Math.round(((item.count || 0) / max) * 100));
      return `
        <div class="history-bar">
          <span title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span>
          <div class="history-bar-track"><div class="history-bar-fill" style="width:${pct}%"></div></div>
          <span>${escapeHtml(item.count || 0)}</span>
        </div>
      `;
    }).join('');
  }

  function renderHistoryList(items) {
    const list = Array.isArray(items) ? items : [];
    if (!list.length) {
      historyList.innerHTML = '<p class="history-empty">还没有播放历史，先听几首歌吧。</p>';
      return;
    }
    historyList.innerHTML = list.map((item) => {
      const artist = item.artist || item.album || '未知歌手';
      const category = item.category || (item.category_ids || [])[0] || '-';
      return `
        <div class="history-item">
          <span class="history-time">${escapeHtml(fmtHistoryTime(item.played_at))}</span>
          <span class="history-song">
            <strong title="${escapeHtml(item.song_name || '')}">${escapeHtml(item.song_name || '未知歌曲')}</strong>
            <span title="${escapeHtml(artist)}">${escapeHtml(artist)}</span>
          </span>
          <span class="history-category" title="${escapeHtml(category)}">${escapeHtml(category)}</span>
        </div>
      `;
    }).join('');
  }

  function renderHistory(data) {
    renderHistoryStats(data || {});
    renderHistoryBars(historyArtists, data?.topArtists, '暂无歌手统计，播放后会自动积累。');
    renderHistoryBars(historyCategories, data?.topCategories, '暂无类型统计，按类型播放后会逐渐丰富。');
    renderHistoryList(data?.recent);
  }

  function renderQueue(data) {
    S.queue = data || S.queue;
    const q = S.queue || {};
    const next = Array.isArray(q.next) ? q.next : [];
    if (queueCount) queueCount.textContent = `${q.count || 0} TRACKS`;
    if (!queueList) return;
    if (!next.length) {
      queueList.innerHTML = '<span class="queue-empty">暂无待播歌曲</span>';
      return;
    }
    queueList.innerHTML = next.map((item, index) => `
      <div class="queue-item">
        <span>${String(index + 1).padStart(2, '0')}</span>
        <strong title="${escapeHtml(item.name)}">${escapeHtml(item.name || '未知歌曲')}</strong>
        <em title="${escapeHtml(item.artist)}">${escapeHtml(item.artist || '未知歌手')}</em>
      </div>
    `).join('');
  }

  async function refreshQueue() {
    try {
      const res = await fetch('/api/queue?limit=5');
      const data = await res.json();
      renderQueue(data);
    } catch {
      if (queueList) queueList.innerHTML = '<span class="queue-empty">队列暂时无法同步</span>';
    }
  }

  async function postQueueAction(url, body) {
    const options = { method: 'POST' };
    if (body) {
      options.headers = { 'Content-Type': 'application/json' };
      options.body = JSON.stringify(body);
    }
    const res = await fetch(url, options);
    return res.json();
  }

  // ─── WebSocket ─────────────────────────────────────────────────────────────
  let ws, wsDelay = 1000;

  function connectWS() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}/stream`);

    ws.onopen    = () => { wsDelay = 1000; };
    ws.onmessage = (e) => {
      try { onMessage(JSON.parse(e.data)); } catch {}
    };
    ws.onclose = () => {
      setTimeout(connectWS, wsDelay);
      wsDelay = Math.min(wsDelay * 1.5, 30000);
    };
  }

  function onMessage(d) {
    if (d.type === 'state' || d.type === 'track') {
      if (d.track) loadTrack(d.track, d.userRequested);
      if ('djMessage' in d) typewriter(d.djMessage || '');
      if ('weather' in d) updateWeather(d.weather);
      if ('queue' in d) renderQueue(d.queue);
    } else if (d.type === 'chat' && d.reply) {
      addBubble('dj', d.reply);
    } else if (d.type === 'queue' && d.queue) {
      renderQueue(d.queue);
    }
  }

  function stopCurrentDjVoice(clearText = false) {
    ttsGeneration += 1;
    ttsQueue = [];
    if (ttsAudio) {
      ttsAudio.pause();
      ttsAudio.src = '';
      ttsAudio = null;
    }
    ttsBusy = false;
    if (twTimer) {
      clearInterval(twTimer);
      twTimer = null;
    }
    if (clearText && djText) {
      djText.innerHTML = '<span class="cursor"></span>';
    }
  }

  function requestNextTrack(reason) {
    stopCurrentDjVoice(true);
    if (reason) addBubble('dj', reason);
    return fetch('/api/next', { method: 'POST' }).catch(() => {});
  }

  // ─── Load track ────────────────────────────────────────────────────────────
  function loadTrack(track, userRequested = false) {
    const isDifferentTrack = !S.track || S.track.id !== track.id;
    if (isDifferentTrack) stopCurrentDjVoice(true);
    S.track = track;
    S.userRequested = userRequested;
    app.classList.remove('loading');

    const artist  = artistOf(track);
    const album   = track.album?.name || track.al?.name || '';
    const picUrl  = track.album?.picUrl || track.al?.picUrl || '';

    songTitle.textContent  = track.name || '未知歌曲';
    songArtist.textContent = artist;
    songAlbum.textContent  = album;

    if (picUrl) {
      const img = new Image();
      img.onload = () => {
        cover.src = picUrl;
      };
      img.src = picUrl;
    }

    audio.src = `/api/music/stream/${track.id}`;
    audio.load();

    audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));

    document.title = `${track.name} — CLAUDIO.FM`;

    // Reset lyric if open
    if (S.lyricOpen) loadLyric(track.id);
  }

  // ─── Playback ──────────────────────────────────────────────────────────────
  function setPlaying(v) {
    S.playing = v;
    btnPlay.textContent = v ? 'Ⅱ' : '▶';
    if (stationStatus) stationStatus.textContent = v ? 'Speaking...' : 'Standby';
    app.classList.toggle('playing', v);
    vinyl.classList.toggle('playing', v);
  }

  btnPlay.onclick = () => {
    if (audio.paused) { audio.play(); } else { audio.pause(); }
  };

  btnNext.onclick = () => requestNextTrack();

  btnPrev.onclick = () => {
    if (audio.currentTime > 4) audio.currentTime = 0;
    // else: could implement previous track from history
  };

  if (btnLike) btnLike.onclick = () => sendFeedbackCommand('\u559c\u6b22\u8fd9\u9996');
  if (btnDislike) btnDislike.onclick = () => sendFeedbackCommand('\u5c11\u653e\u8fd9\u9996');

  audio.onended  = () => requestNextTrack();
  audio.onplay   = () => setPlaying(true);
  audio.onpause  = () => setPlaying(false);

  // Skip Netease 30-second trial clips; QQ songs with VIP always play to end
  audio.onloadedmetadata = () => {
    const dur = audio.duration;
    const isQQ = S.track?.id?.startsWith?.('qq:');
    if (!isQQ && dur > 0 && dur <= 35) {
      console.warn(`Netease 试听片段（${Math.round(dur)}s），自动跳过`);
      requestNextTrack(`《${S.track?.name || '该歌曲'}》只有试听版，马上换下一首。`);
    }
  };

  audio.onerror = () => {
    if (S.userRequested) {
      // User explicitly asked for this song — don't auto-skip, show explanation
      S.userRequested = false;
      const name = S.track?.name || '该歌曲';
      console.warn(`User-requested track failed: ${name}`);
      addBubble('dj', `《${name}》在当前平台没有可播放的版权，试试换一首？`);
      if (!S.chatOpen) {
        // Briefly open chat so user sees the message
        S.chatOpen = true;
        chat.style.display = 'block';
        btnChat.classList.add('active');
      }
    } else {
      console.warn('Audio error — requesting next track');
      requestNextTrack(`《${S.track?.name || '该歌曲'}》暂时没有可播放版权，马上换下一首。`);
    }
  };

  // ─── Progress bar ──────────────────────────────────────────────────────────
  audio.ontimeupdate = () => {
    if (!audio.duration) return;
    const pct = (audio.currentTime / audio.duration) * 100;
    fill.style.width = `${pct}%`;
    tCur.textContent = fmtTime(audio.currentTime);
    tEnd.textContent = fmtTime(audio.duration);
    if (S.lyricOpen) syncLyric();
  };

  bar.onclick = (e) => {
    const { left, width } = bar.getBoundingClientRect();
    audio.currentTime = ((e.clientX - left) / width) * audio.duration;
  };

  // ─── Volume ────────────────────────────────────────────────────────────────
  function setVolume(value) {
    const v = Math.max(0, Math.min(1, Number(value)));
    audio.volume = v;
    if (volPct) volPct.textContent = `${Math.round(v * 100)}%`;
    if (volSlider) {
      volSlider.value = String(v);
      volSlider.style.setProperty('--vol', `${v * 100}%`);
    }
  }

  volSlider.oninput = () => { setVolume(volSlider.value); };
  setVolume(0.8);

  // ─── TTS (Edge TTS via server) ────────────────────────────────────────────
  let ttsQueue = [], ttsBusy = false, audioUnlocked = false;
  let ttsGeneration = 0;
  let ttsAudio = null;

  // Browsers block audio until first user gesture — unlock on any interaction
  function unlockAudio() {
    if (audioUnlocked) return;
    audioUnlocked = true;
    drainTTS();
  }
  document.addEventListener('click',   unlockAudio);
  document.addEventListener('keydown', unlockAudio);
  document.addEventListener('touchstart', unlockAudio);

  function speak(text) {
    if (!S.ttsEnabled) return;
    ttsQueue.push(text);
    if (audioUnlocked) drainTTS();
  }

  function drainTTS() {
    if (!audioUnlocked || ttsBusy || !ttsQueue.length) return;
    const text = ttsQueue.shift();
    const generation = ttsGeneration;
    ttsBusy = true;

    fetch(`/api/tts?text=${encodeURIComponent(text)}`)
      .then((r) => {
        if (!r.ok) throw new Error('tts error');
        return r.blob();
      })
      .then((blob) => {
        if (generation !== ttsGeneration) {
          ttsBusy = false;
          return;
        }
        const url = URL.createObjectURL(blob);
        ttsAudio = new Audio(url);
        ttsAudio.onended = ttsAudio.onerror = () => {
          URL.revokeObjectURL(url);
          if (generation !== ttsGeneration) return;
          ttsBusy = false;
          drainTTS();
        };
        ttsAudio.play().catch(() => {
          if (generation !== ttsGeneration) return;
          ttsBusy = false;
          drainTTS();
        });
      })
      .catch(() => {
        if (generation !== ttsGeneration) return;
        ttsBusy = false;
        drainTTS();
      });
  }

  btnTts.onclick = () => {
    S.ttsEnabled = !S.ttsEnabled;
    btnTts.classList.toggle('active', S.ttsEnabled);
    btnTts.textContent = S.ttsEnabled ? 'VOICE' : 'MUTE';
    if (!S.ttsEnabled) {
      stopCurrentDjVoice();
    }
    // Clicking the TTS button also counts as user interaction
    unlockAudio();
  };

  // ─── Typewriter ────────────────────────────────────────────────────────────
  let twTimer = null;

  function typewriter(text) {
    if (twTimer) clearInterval(twTimer);
    if (!text) {
      stopCurrentDjVoice(true);
      return;
    }
    djText.innerHTML = '<span class="cursor"></span>';
    let i = 0;
    twTimer = setInterval(() => {
      if (i < text.length) {
        djText.innerHTML = text.slice(0, ++i) + '<span class="cursor"></span>';
      } else {
        clearInterval(twTimer);
        twTimer = null;
        speak(text);
      }
    }, 38);
  }

  // ─── Chat ──────────────────────────────────────────────────────────────────
  btnChat.onclick = () => {
    S.chatOpen = !S.chatOpen;
    chat.style.display = S.chatOpen ? 'block' : 'none';
    btnChat.classList.toggle('active', S.chatOpen);
    if (S.chatOpen && quickIn) quickIn.focus();
  };

  function openChat(focus = false) {
    if (!S.chatOpen) {
      S.chatOpen = true;
      chat.style.display = 'block';
      btnChat.classList.add('active');
    }
    if (focus && quickIn) quickIn.focus();
  }

  async function submitMessage(msg) {
    addBubble('user', msg);
    try {
      const res  = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg })
      });
      const data = await res.json();
      if (data.reply) addBubble('dj', data.reply);
    } catch {
      addBubble('dj', '信号有点弱，稍后再试~');
    }
  }

  async function sendFeedbackCommand(message) {
    if (!S.track) {
      addBubble('dj', '\u7b49\u6b4c\u66f2\u52a0\u8f7d\u51fa\u6765\u540e\uff0c\u6211\u518d\u5e2e\u4f60\u8bb0\u8fd9\u6761\u504f\u597d\u3002');
      return;
    }
    openChat(false);
    await submitMessage(message);
  }

  async function sendQuick() {
    const msg = quickIn?.value.trim();
    if (!msg) return;
    quickIn.value = '';
    openChat(false);
    await submitMessage(msg);
  }

  if (quickSend) quickSend.onclick = sendQuick;
  if (quickIn) quickIn.onkeydown = (e) => { if (e.key === 'Enter') sendQuick(); };
  if (quickMic) {
    quickMic.onclick = () => {
      openChat(false);
      startVoiceInput();
    };
  }

  if (queueSkip) {
    queueSkip.onclick = async () => {
      try {
        const data = await postQueueAction('/api/queue/skip-next');
        renderQueue(data.queue);
        if (data.removed) addBubble('dj', `已从队列移除下一首《${data.removed.name}》。`);
      } catch {
        addBubble('dj', '队列暂时没改成，稍后再试。');
      }
    };
  }

  if (queueRebuild) {
    queueRebuild.onclick = async () => {
      try {
        const data = await postQueueAction('/api/queue/rebuild');
        renderQueue(data.queue);
        addBubble('dj', '队列已经重新生成。');
      } catch {
        addBubble('dj', '重新生成队列失败，稍后再试。');
      }
    };
  }

  if (queueInsert) {
    queueInsert.onclick = async () => {
      const message = quickIn?.value.trim();
      if (!message) {
        openChat(true);
        addBubble('dj', '先在输入框写一首歌名，再点 INSERT。');
        return;
      }
      try {
        const data = await postQueueAction('/api/queue/insert', { message });
        if (data.queue) renderQueue(data.queue);
        if (data.ok && data.inserted) {
          quickIn.value = '';
          addBubble('dj', `《${data.inserted.name}》已插到下一首。`);
        } else {
          addBubble('dj', data.reason || '这首歌暂时没插进去。');
        }
      } catch {
        addBubble('dj', '插队失败，稍后再试。');
      }
    };
  }

  function startVoiceInput() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      addBubble('dj', '当前浏览器不支持语音输入，先用文字和 Claudio 聊天吧。');
      return;
    }
    const recog = new SpeechRecognition();
    recog.lang = 'zh-CN';
    recog.interimResults = false;
    recog.maxAlternatives = 1;
    quickMic.textContent = '...';
    quickMic.disabled = true;
    recog.onresult = (event) => {
      const text = event.results?.[0]?.[0]?.transcript?.trim();
      if (!text) return;
      quickIn.value = text;
      sendQuick();
    };
    recog.onerror = () => addBubble('dj', '没听清楚，再点一次 MIC 试试。');
    recog.onend = () => {
      quickMic.textContent = 'MIC';
      quickMic.disabled = false;
    };
    recog.start();
  }

  function addBubble(role, text) {
    const d = document.createElement('div');
    d.className = `bubble ${role}`;
    d.textContent = text;
    chatMsgs.appendChild(d);
    chatMsgs.scrollTop = chatMsgs.scrollHeight;
  }

  function addImportSummary(data) {
    const d = document.createElement('div');
    d.className = 'bubble dj import-summary';
    const lines = (data.log || []).filter(Boolean).slice(0, 18);
    d.innerHTML = `
      <strong>歌单导入完成</strong>
      <dl>
        <div><dt>网易云</dt><dd>${data.neteaseCount} 个歌单</dd></div>
        <div><dt>QQ音乐</dt><dd>${data.qqCount} 个歌单</dd></div>
        <div><dt>歌曲</dt><dd>${data.totalSongs} 首</dd></div>
      </dl>
      <details>
        <summary>查看导入日志</summary>
        <pre></pre>
      </details>
    `;
    d.querySelector('pre').textContent = lines.join('\n');
    chatMsgs.appendChild(d);
    chatMsgs.scrollTop = chatMsgs.scrollHeight;
  }

  // ─── Lyrics ────────────────────────────────────────────────────────────────
  btnLyric.onclick = async () => {
    if (!S.lyricOpen) {
      if (S.track) await loadLyric(S.track.id);
      lyricOv.classList.add('open');
      S.lyricOpen = true;
      btnLyric.classList.add('active');
    } else {
      closeLyric();
    }
  };

  lyricClose.onclick = closeLyric;

  btnHistory.onclick = async () => {
    if (S.historyOpen) {
      closeHistory();
      return;
    }
    await openHistory();
  };

  historyClose.onclick = closeHistory;
  historyOv.onclick = (e) => {
    if (e.target === historyOv) closeHistory();
  };

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && S.historyOpen) closeHistory();
  });

  async function openHistory() {
    S.historyOpen = true;
    historyOv.classList.add('open');
    historyOv.setAttribute('aria-hidden', 'false');
    btnHistory.classList.add('active');
    historyStats.innerHTML = '<div class="history-stat"><span>LOADING</span><strong>...</strong></div>';
    historyArtists.innerHTML = '<p class="history-empty">正在读取播放历史...</p>';
    historyCategories.innerHTML = '';
    historyList.innerHTML = '';
    try {
      const res = await fetch('/api/history?limit=120');
      const data = await res.json();
      renderHistory(data);
    } catch {
      historyStats.innerHTML = '';
      historyArtists.innerHTML = '<p class="history-empty">播放历史加载失败，稍后再试。</p>';
      historyCategories.innerHTML = '';
      historyList.innerHTML = '';
    }
  }

  function closeHistory() {
    S.historyOpen = false;
    historyOv.classList.remove('open');
    historyOv.setAttribute('aria-hidden', 'true');
    btnHistory.classList.remove('active');
  }

  // ─── Import playlists + Generate Taste ────────────────────────────────────
  btnTaste.onclick = async () => {
    btnTaste.disabled = true;
    const showChat = () => { if (!S.chatOpen) { S.chatOpen = true; chat.style.display = 'block'; btnChat.classList.add('active'); } };

    // Step 1: Import playlists
    btnTaste.textContent = 'SYNC';
    btnTaste.title = '正在导入歌单…';
    addBubble('dj', '开始从网易云 + QQ音乐导入歌单，请稍候…');
    showChat();

    try {
      const r1 = await fetch('/api/import-playlists', { method: 'POST' });
      const d1 = await r1.json();
      if (!d1.ok) {
        addBubble('dj', `导入失败：${d1.log?.join(' | ') || '未知错误'}`);
        btnTaste.textContent = 'TASTE'; btnTaste.disabled = false;
        return;
      }
      addImportSummary(d1);

      // Step 2: Generate taste.md
      btnTaste.title = '正在生成品味档案…';
      addBubble('dj', '正在用 AI 分析你的音乐品味…');
      const r2 = await fetch('/api/generate-taste', { method: 'POST' });
      const d2 = await r2.json();
      if (d2.ok) {
        btnTaste.textContent = 'DONE';
        btnTaste.title = `品味档案已更新（${d2.playlistCount} 个歌单，${d2.songCount} 首歌）`;
        addBubble('dj', `✨ 品味档案生成完毕！DJ 推荐将更贴合你的口味~`);
      } else {
        addBubble('dj', `品味生成失败：${d2.reason || '未知错误'}`);
      }
    } catch (e) {
      addBubble('dj', `操作失败：${e.message}`);
    }

    btnTaste.disabled = false;
    setTimeout(() => { if (btnTaste.textContent === 'DONE') { btnTaste.textContent = 'TASTE'; btnTaste.title = '从歌单导入并生成品味档案'; } }, 8000);
  };

  function closeLyric() {
    lyricOv.classList.remove('open');
    S.lyricOpen = false;
    btnLyric.classList.remove('active');
  }

  async function loadLyric(id) {
    lyricScroll.innerHTML = '<div class="lyric-line" style="color:var(--muted)">加载中…</div>';
    try {
      const res  = await fetch(`/api/music/lyric/${id}`);
      const data = await res.json();
      parseLyric(data.lyric || '');
      renderLyric(-1);
    } catch {
      lyricScroll.innerHTML = '<div class="lyric-line">暂无歌词</div>';
    }
  }

  function parseLyric(raw) {
    S.lyricLines = [];
    for (const line of raw.split('\n')) {
      const m = line.match(/\[(\d+):(\d+)[.:]([\d]+)\](.*)/);
      if (m) {
        const time = parseInt(m[1]) * 60 + parseFloat(`${m[2]}.${m[3]}`);
        const text = m[4].trim();
        if (text) S.lyricLines.push({ time, text });
      }
    }
  }

  function renderLyric(activeIdx) {
    lyricScroll.innerHTML = S.lyricLines.map((l, i) =>
      `<div class="lyric-line${i === activeIdx ? ' active' : ''}">${l.text}</div>`
    ).join('') || '<div class="lyric-line">暂无歌词</div>';

    if (activeIdx >= 0) {
      const el = lyricScroll.children[activeIdx];
      if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }

  let lastLyricIdx = -1;

  function syncLyric() {
    if (!S.lyricLines.length) return;
    const t = audio.currentTime;
    let idx = -1;
    for (let i = S.lyricLines.length - 1; i >= 0; i--) {
      if (S.lyricLines[i].time <= t) { idx = i; break; }
    }
    if (idx !== lastLyricIdx) {
      lastLyricIdx = idx;
      if (S.lyricOpen) renderLyric(idx);
    }
  }

  // ─── Init ──────────────────────────────────────────────────────────────────
  async function init() {
    updateClock();
    setInterval(updateClock, 15000);
    try {
      const res  = await fetch('/api/now');
      const data = await res.json();
      if (data.track)     loadTrack(data.track);
      if (data.djMessage) typewriter(data.djMessage);
      if ('weather' in data) updateWeather(data.weather);
      if ('queue' in data) renderQueue(data.queue);
      else refreshQueue();
    } catch {
      songTitle.textContent = '正在连接…';
    }
    connectWS();
  }

  // PWA service worker registration
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

  init();
})();
