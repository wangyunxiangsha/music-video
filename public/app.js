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
    settingsOpen:  false,
    lyricLines:    [],
    userRequested: false,
    queue:         null,
    settings:      null,
    queueCollapsed:false,
    dailyBriefingKey: '',
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
  const songReason = $('song-reason');
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
  const btnSaveLocal = $('btn-save-local');
  const btnRemoveLocal = $('btn-remove-local');
  const btnSettings = $('btn-settings');
  const statusScene = $('status-scene');
  const statusRatio = $('status-ratio');
  const statusDj = $('status-dj');
  const playbackNotice = $('playback-notice');
  const settingsPanel = $('settings-panel');
  const settingExternalEnabled = $('setting-external-enabled');
  const settingExternalRatio = $('setting-external-ratio');
  const settingRatioValue = $('setting-ratio-value');
  const settingDjPolicy = $('setting-dj-policy');
  const settingScene = $('setting-scene');
  const memoryExport = $('memory-export');
  const memoryImport = $('memory-import');
  const memoryImportFile = $('memory-import-file');
  const memoryStatus = $('memory-status');
  const sleepStatus = $('sleep-status');
  const sleepOff = $('sleep-off');
  const alarmTime = $('alarm-time');
  const alarmOn = $('alarm-on');
  const alarmOff = $('alarm-off');
  const alarmStatus = $('alarm-status');
  const blockedList = $('blocked-list');
  const blockedRefresh = $('blocked-refresh');
  const qqLoginStart = $('qq-login-start');
  const qqLoginCancel = $('qq-login-cancel');
  const qqLoginQr = $('qq-login-qr');
  const qqLoginStatus = $('qq-login-status');
  const accountStatusList = $('account-status-list');
  const neteaseLoginStart = $('netease-login-start');
  const neteaseLoginCancel = $('netease-login-cancel');
  const neteaseLoginQr = $('netease-login-qr');
  const neteaseLoginStatus = $('netease-login-status');
  const lyricOv   = $('lyric-overlay');
  const lyricScroll = $('lyric-scroll');
  const lyricClose  = $('lyric-close');
  const historyOv = $('history-overlay');
  const historyClose = $('history-close');
  const todayReport = $('today-report');
  const historyStats = $('history-stats');
  const historyArtists = $('history-artists');
  const historyCategories = $('history-categories');
  const historyList = $('history-list');
  const queueStrip = document.querySelector('.queue-strip');
  const queueCount = $('queue-count');
  const queueList = $('queue-list');
  const queueToggle = $('queue-toggle');
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

  function recommendationLabel(track = {}) {
    const reason = track.playbackSwitchReason || track.recommendationReason || '';
    if (reason) return reason;
    if (track.recommendationSource === 'external') return '外部推荐';
    if (track.recommendationSource === 'local') return '来自本地歌单';
    return '';
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

  function pctLabel(value) {
    return `${Math.round(Math.max(0, Math.min(1, Number(value) || 0)) * 100)}%`;
  }

  function topName(items, fallback = '暂无') {
    const first = Array.isArray(items) ? items.find((item) => item?.name) : null;
    return first ? `${first.name} ×${first.count || 0}` : fallback;
  }

  function renderTodayReport(report) {
    if (!todayReport) return;
    const data = report || {};
    if (!data.playCount) {
      todayReport.innerHTML = `
        <div class="today-report-head">
          <span>TODAY</span>
          <strong>今天还没留下播放记录</strong>
        </div>
        <p class="today-report-empty">听几首歌后，这里会汇总今天的常听歌手、类型和推荐命中情况。</p>
      `;
      return;
    }
    const feedback = data.feedback || {};
    const learningItems = [
      ...(Array.isArray(data.insights) ? data.insights : []),
      ...(Array.isArray(data.adjustments) ? data.adjustments : [])
    ].slice(0, 4);
    const metrics = [
      ['播放', data.playCount || 0],
      ['去重', data.uniqueSongCount || 0],
      ['外部推荐', pctLabel(data.externalRatio)],
      ['跳过', feedback.skipCount || 0]
    ];
    todayReport.innerHTML = `
      <div class="today-report-head">
        <span>TODAY</span>
        <strong>今日听歌报告</strong>
      </div>
      <div class="today-report-metrics">
        ${metrics.map(([label, value]) => `
          <div>
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(value)}</strong>
          </div>
        `).join('')}
      </div>
      <div class="today-report-notes">
        <span>歌手 ${escapeHtml(topName(data.topArtists))}</span>
        <span>类型 ${escapeHtml(topName(data.topCategories))}</span>
        <span>不对味 ${escapeHtml(feedback.notVibeCount || 0)}</span>
      </div>
      <div class="today-report-learning">
        ${learningItems.map(item => `<span>${escapeHtml(item)}</span>`).join('')}
      </div>
    `;
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
    renderTodayReport(data?.todayReport);
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
    queueList.innerHTML = next.map((item, index) => {
      const reason = recommendationLabel(item);
      return `
      <div class="queue-item">
        <span>${String(index + 1).padStart(2, '0')}</span>
        <div class="queue-main">
          <strong title="${escapeHtml(item.name)}">${escapeHtml(item.name || '未知歌曲')}</strong>
          ${reason ? `<small class="queue-reason" title="${escapeHtml(reason)}">${escapeHtml(reason)}</small>` : ''}
        </div>
        <em title="${escapeHtml(item.artist)}">${escapeHtml(item.artist || '未知歌手')}</em>
      </div>
    `;
    }).join('');
  }

  function renderQueueStatus(message) {
    if (!queueList) return;
    queueList.innerHTML = `<span class="queue-empty">${escapeHtml(message)}</span>`;
  }

  function setQueueActionPending(button, pending, idleLabel) {
    if (!button) return;
    button.disabled = pending;
    button.textContent = pending ? 'BUSY' : idleLabel;
    button.setAttribute('aria-busy', String(pending));
  }

  function ratioLabel(value) {
    return `${Math.round(Math.max(0, Math.min(1, Number(value) || 0)) * 100)}%`;
  }

  function renderStationStatus(settings = S.settings) {
    const scene = settings?.scene?.name || settings?.effectiveScene?.name || '默认电台';
    const policy = settings?.scene?.name
      ? (settings?.djPolicy?.name || '正常播报')
      : (settings?.effectiveDjPolicy?.name || settings?.djPolicy?.name || '正常播报');
    const rec = settings?.recommendation || {};
    const ratio = rec.externalEnabled === false ? 'OFF' : ratioLabel(rec.externalRatio);
    if (statusScene) statusScene.textContent = scene;
    if (statusRatio) statusRatio.textContent = ratio;
    if (statusDj) statusDj.textContent = policy;
  }

  function renderSettingsPanel(settings = S.settings) {
    if (!settings) return;
    S.settings = settings;
    const rec = settings.recommendation || {};
    if (settingExternalEnabled) settingExternalEnabled.checked = rec.externalEnabled !== false;
    if (settingExternalRatio) settingExternalRatio.value = String(rec.configuredExternalRatio ?? rec.externalRatio ?? 0.25);
    if (settingRatioValue) settingRatioValue.textContent = ratioLabel(settingExternalRatio?.value || rec.externalRatio);
    if (settingDjPolicy) settingDjPolicy.value = settings.djPolicy?.mode || 'normal';
    if (settingScene) {
      const scenes = Array.isArray(settings.scenes) ? settings.scenes : [];
      const current = settings.scene?.id || '';
      settingScene.innerHTML = '<option value="">默认电台</option>' + scenes.map((scene) =>
        `<option value="${escapeHtml(scene.id)}">${escapeHtml(scene.name)}</option>`
      ).join('');
      settingScene.value = current;
    }
    renderStationStatus(settings);
  }

  function updateSaveLocalButton() {
    if (!btnSaveLocal) return;
    const external = S.track?.recommendationSource === 'external';
    btnSaveLocal.disabled = !external;
    btnSaveLocal.textContent = external ? 'SAVE' : 'LOCAL';
    btnSaveLocal.title = external ? '把这首外部推荐加入本地歌单池' : '当前歌曲已在本地歌单池';
  }

  function updateRemoveLocalButton() {
    if (!btnRemoveLocal) return;
    const source = S.track?.recommendationSource;
    const removable = Boolean(S.track) && source !== 'external' && source !== 'removed';
    btnRemoveLocal.disabled = !removable;
    btnRemoveLocal.textContent = 'REMOVE';
    btnRemoveLocal.title = removable ? '从本地歌单池删除并永久屏蔽' : '外部推荐不在本地歌单池';
  }

  async function loadSettings() {
    try {
      const res = await fetch('/api/settings');
      const settings = await res.json();
      renderSettingsPanel(settings);
      loadBlockedTracks();
    } catch {
      renderStationStatus(S.settings);
    }
  }

  async function saveSettingsPatch(patch) {
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch)
    });
    const data = await res.json();
    if (data.settings) renderSettingsPanel(data.settings);
    if (data.queue) renderQueue(data.queue);
    return data;
  }

  let sleepTimer = null;
  let sleepFadeTimer = null;
  let sleepEndsAt = 0;
  let sleepBaseVolume = 0.8;

  function setSleepStatus(text) {
    if (sleepStatus) sleepStatus.textContent = text || '未开启';
  }

  function cancelSleepTimer() {
    const hadTimer = Boolean(sleepTimer || sleepFadeTimer || sleepEndsAt);
    if (sleepTimer) clearInterval(sleepTimer);
    if (sleepFadeTimer) clearInterval(sleepFadeTimer);
    sleepTimer = null;
    sleepFadeTimer = null;
    sleepEndsAt = 0;
    if (hadTimer) setVolume(sleepBaseVolume);
    setSleepStatus('未开启');
  }

  function beginSleepFade() {
    if (sleepTimer) clearInterval(sleepTimer);
    sleepTimer = null;
    if (sleepFadeTimer) clearInterval(sleepFadeTimer);
    const startVolume = audio.volume;
    const fadeMs = 30000;
    const started = Date.now();
    setSleepStatus('正在渐弱停止...');
    sleepFadeTimer = setInterval(() => {
      const progress = Math.min(1, (Date.now() - started) / fadeMs);
      setVolume(startVolume * (1 - progress));
      if (progress >= 1) {
        clearInterval(sleepFadeTimer);
        sleepFadeTimer = null;
        audio.pause();
        setVolume(sleepBaseVolume);
        setSleepStatus('已停止');
      }
    }, 1000);
  }

  function renderSleepCountdown() {
    const remainingMs = sleepEndsAt - Date.now();
    if (remainingMs <= 0) {
      beginSleepFade();
      return;
    }
    const minutes = Math.ceil(remainingMs / 60000);
    setSleepStatus(`${minutes} 分钟后渐弱停止`);
  }

  function startSleepTimer(minutes) {
    const value = Number(minutes);
    if (!value) return;
    if (sleepTimer) clearInterval(sleepTimer);
    if (sleepFadeTimer) clearInterval(sleepFadeTimer);
    sleepBaseVolume = audio.volume;
    sleepEndsAt = Date.now() + value * 60000;
    renderSleepCountdown();
    sleepTimer = setInterval(renderSleepCountdown, 1000);
  }

  let alarmTimer = null;
  let alarmFadeTimer = null;
  let alarmTargetTime = '';
  let alarmTargetVolume = 0.8;

  function setAlarmStatus(text) {
    if (alarmStatus) alarmStatus.textContent = text || '未开启';
  }

  function minutesUntilTime(timeValue) {
    const match = /^(\d{2}):(\d{2})$/.exec(timeValue || '');
    if (!match) return null;
    const now = new Date();
    const target = new Date(now);
    target.setHours(Number(match[1]), Number(match[2]), 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);
    return Math.ceil((target - now) / 60000);
  }

  function cancelAlarmTimer() {
    if (alarmTimer) clearInterval(alarmTimer);
    if (alarmFadeTimer) clearInterval(alarmFadeTimer);
    alarmTimer = null;
    alarmFadeTimer = null;
    alarmTargetTime = '';
    setAlarmStatus('未开启');
  }

  function beginAlarmFadeIn() {
    if (alarmFadeTimer) clearInterval(alarmFadeTimer);
    const fadeMs = 20000;
    const started = Date.now();
    setVolume(0.02);
    alarmFadeTimer = setInterval(() => {
      const progress = Math.min(1, (Date.now() - started) / fadeMs);
      setVolume(alarmTargetVolume * progress);
      if (progress >= 1) {
        clearInterval(alarmFadeTimer);
        alarmFadeTimer = null;
        setVolume(alarmTargetVolume);
        setAlarmStatus('已响铃');
      }
    }, 1000);
  }

  function triggerAlarm() {
    cancelAlarmTimer();
    if (!audio.paused) {
      showPlaybackNotice('闹钟时间到，电台已经在播放。');
      setAlarmStatus('已响铃');
      return;
    }
    alarmTargetVolume = Math.max(0.2, Number(audio.volume || volSlider?.value || 0.8));
    beginAlarmFadeIn();
    const playResult = audio.play();
    if (playResult?.catch) {
      playResult
        .then(() => setPlaying(true))
        .catch(() => {
          requestNextTrack('', 'alarm_start');
          showPlaybackNotice('闹钟时间到，正在尝试开始播放。');
        });
    }
    showPlaybackNotice('闹钟时间到，Claudio 已开始播放。');
  }

  function renderAlarmCountdown() {
    const minutes = minutesUntilTime(alarmTargetTime);
    if (minutes === null) {
      cancelAlarmTimer();
      setAlarmStatus('时间格式无效');
      return;
    }
    const now = new Date();
    const current = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    if (current === alarmTargetTime) {
      triggerAlarm();
      return;
    }
    setAlarmStatus(`${alarmTargetTime} 响铃，约 ${minutes} 分钟后`);
  }

  function startAlarmTimer() {
    const value = alarmTime?.value || '';
    if (!value) {
      setAlarmStatus('请选择时间');
      return;
    }
    if (alarmTimer) clearInterval(alarmTimer);
    if (alarmFadeTimer) clearInterval(alarmFadeTimer);
    alarmTargetTime = value;
    renderAlarmCountdown();
    alarmTimer = setInterval(renderAlarmCountdown, 1000);
  }

  function renderBlockedTracks(items = []) {
    if (!blockedList) return;
    if (!items.length) {
      blockedList.innerHTML = '<p class="blocked-empty">暂无屏蔽歌曲</p>';
      return;
    }
    blockedList.innerHTML = items.map(item => `
      <div class="blocked-item">
        <div>
          <strong>${escapeHtml(item.name || item.key)}</strong>
          <span>${escapeHtml(item.artist || '')}</span>
        </div>
        <button type="button" data-restore-key="${escapeHtml(item.key)}">RESTORE</button>
      </div>
    `).join('');
  }

  async function loadBlockedTracks() {
    if (!blockedList) return;
    try {
      const res = await fetch('/api/local-pool/removed');
      const data = await res.json();
      renderBlockedTracks(data.removedTracks || []);
    } catch {
      blockedList.innerHTML = '<p class="blocked-empty">屏蔽列表读取失败</p>';
    }
  }

  async function restoreBlockedTrack(key) {
    if (!key) return;
    const res = await fetch('/api/local-pool/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data.reason || '恢复失败');
    await loadBlockedTracks();
    showPlaybackNotice('已恢复屏蔽歌曲');
  }

  function memoryFileName() {
    const d = new Date();
    const date = [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0')
    ].join('-');
    return `Claudio电台记忆-${date}.claudio`;
  }

  function setMemoryStatus(text) {
    if (memoryStatus) memoryStatus.textContent = text || '';
  }

  async function downloadRadioMemory() {
    if (!memoryExport) return;
    memoryExport.disabled = true;
    setMemoryStatus('正在准备记忆文件...');
    try {
      const res = await fetch('/api/memory/export');
      if (!res.ok) throw new Error(`export ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = memoryFileName();
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMemoryStatus('记忆文件已导出');
    } catch {
      setMemoryStatus('记忆导出失败，稍后再试');
    } finally {
      memoryExport.disabled = false;
    }
  }

  async function importRadioMemory(file) {
    if (!file) return;
    if (!window.confirm('导入后会合并电台偏好，并自动备份当前记忆。继续吗？')) return;
    setMemoryStatus('正在恢复电台记忆...');
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const res = await fetch('/api/memory/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || `import ${res.status}`);
      const imported = data.imported || {};
      const skipped = data.skipped || {};
      setMemoryStatus(`已恢复 ${imported.plays || 0} 条播放、${imported.feedback || 0} 条反馈，跳过 ${skipped.plays || 0} 条重复`);
      loadSettings();
    } catch {
      setMemoryStatus('记忆文件无法导入');
    } finally {
      if (memoryImportFile) memoryImportFile.value = '';
    }
  }

  function renderQqLoginStatus(data = {}) {
    if (qqLoginStatus) {
      const cookie = data.cookie || {};
      const tokenReady = cookie.qqmusicKey?.present || cookie.qmKeyst?.present;
      const playbackMissing = tokenReady && data.qqPlaybackAuth && !data.qqPlaybackAuth?.playbackKeyReady;
      qqLoginStatus.textContent = data.qqCookieHealth?.suspectedExpired
        ? (data.qqCookieHealth.message || 'QQ 音乐 Cookie 疑似过期，请扫码刷新')
        : (playbackMissing
          ? '\u0051\u0051 \u97f3\u4e50\u5df2\u767b\u5f55\uff0c\u4f46\u8fd8\u7f3a\u64ad\u653e\u6388\u6743\uff0c\u8bf7\u626b\u7801\u5237\u65b0'
          : (data.message || (tokenReady ? 'QQ 音乐 Cookie 已配置' : 'QQ 音乐登录未就绪')));
    }
    if (qqLoginQr) {
      if (data.qrDataUrl) {
        qqLoginQr.src = data.qrDataUrl;
        qqLoginQr.hidden = false;
      } else {
        qqLoginQr.removeAttribute('src');
        qqLoginQr.hidden = true;
      }
    }
    if (qqLoginStart) qqLoginStart.disabled = data.status === 'starting' || data.status === 'waiting_scan';
  }

  async function refreshQqLoginStatus() {
    try {
      const res = await fetch('/api/qq-login/status');
      renderQqLoginStatus(await res.json());
    } catch {
      if (qqLoginStatus) qqLoginStatus.textContent = 'QQ 登录状态暂时不可用';
    }
  }

  async function startQqLogin() {
    if (!qqLoginStart) return;
    qqLoginStart.disabled = true;
    if (qqLoginStatus) qqLoginStatus.textContent = '正在生成扫码登录二维码...';
    try {
      const res = await fetch('/api/qq-login/start', { method: 'POST' });
      renderQqLoginStatus(await res.json());
      refreshAccountStatus();
    } catch {
      if (qqLoginStatus) qqLoginStatus.textContent = 'QQ 登录助手启动失败';
    }
  }

  async function cancelQqLogin() {
    try {
      const res = await fetch('/api/qq-login/cancel', { method: 'POST' });
      renderQqLoginStatus(await res.json());
      refreshAccountStatus();
    } catch {
      if (qqLoginStatus) qqLoginStatus.textContent = '取消失败';
    }
  }

  function renderNeteaseLoginStatus(data = {}) {
    if (neteaseLoginStatus) {
      const cookie = data.cookie || {};
      const ready = cookie.musicU?.present;
      neteaseLoginStatus.textContent = data.message || (ready ? '网易云音乐 Cookie 已配置' : '网易云音乐登录未就绪');
    }
    if (neteaseLoginQr) {
      if (data.qrDataUrl) {
        neteaseLoginQr.src = data.qrDataUrl;
        neteaseLoginQr.hidden = false;
      } else {
        neteaseLoginQr.removeAttribute('src');
        neteaseLoginQr.hidden = true;
      }
    }
    if (neteaseLoginStart) neteaseLoginStart.disabled = data.status === 'starting' || data.status === 'waiting_scan';
  }

  async function refreshNeteaseLoginStatus() {
    try {
      const res = await fetch('/api/netease-login/status');
      renderNeteaseLoginStatus(await res.json());
    } catch {
      if (neteaseLoginStatus) neteaseLoginStatus.textContent = '网易云登录状态暂时不可用';
    }
  }

  async function startNeteaseLogin() {
    if (!neteaseLoginStart) return;
    neteaseLoginStart.disabled = true;
    if (neteaseLoginStatus) neteaseLoginStatus.textContent = '正在生成网易云登录二维码...';
    try {
      const res = await fetch('/api/netease-login/start', { method: 'POST' });
      renderNeteaseLoginStatus(await res.json());
      refreshAccountStatus();
    } catch {
      if (neteaseLoginStatus) neteaseLoginStatus.textContent = '网易云登录启动失败';
    }
  }

  async function cancelNeteaseLogin() {
    try {
      const res = await fetch('/api/netease-login/cancel', { method: 'POST' });
      renderNeteaseLoginStatus(await res.json());
      refreshAccountStatus();
    } catch {
      if (neteaseLoginStatus) neteaseLoginStatus.textContent = '取消失败';
    }
  }

  function accountStatusItems(data = {}) {
    return [
      { platform: data.qq?.label || 'QQ 音乐', ...(data.qq?.login || {}) },
      { platform: data.qq?.label || 'QQ 音乐', ...(data.qq?.playback || {}) },
      { platform: data.qq?.label || 'QQ 音乐', ...(data.qq?.cookie || {}) },
      { platform: data.netease?.label || '网易云', ...(data.netease?.login || {}) },
      { platform: data.netease?.label || '网易云', ...(data.netease?.playback || {}) }
    ];
  }

  function renderAccountStatus(data = {}) {
    if (!accountStatusList) return;
    const items = accountStatusItems(data);
    accountStatusList.innerHTML = items.map((entry) => `
      <div class="account-status-item ${escapeHtml(entry.state || 'unknown')}">
        <span>${escapeHtml(entry.platform || '')}</span>
        <strong>${escapeHtml(entry.label || '')}</strong>
        <em>${escapeHtml(entry.message || '')}</em>
      </div>
    `).join('');
  }

  async function refreshAccountStatus() {
    if (!accountStatusList) return;
    try {
      const res = await fetch('/api/account-status');
      renderAccountStatus(await res.json());
    } catch {
      accountStatusList.innerHTML = '<p class="account-status-empty">账号状态暂时不可用</p>';
    }
  }

  function renderQueueFallback(nextTrack, message = '完整队列需要重启服务后同步') {
    if (queueCount) queueCount.textContent = nextTrack ? '1 TRACK' : '0 TRACKS';
    if (!queueList) return;
    if (!nextTrack) {
      queueList.innerHTML = `<span class="queue-empty">${escapeHtml(message)}</span>`;
      return;
    }
    const artist = artistOf(nextTrack);
    const reason = recommendationLabel(nextTrack);
    queueList.innerHTML = `
      <div class="queue-item">
        <span>01</span>
        <div class="queue-main">
          <strong title="${escapeHtml(nextTrack.name)}">${escapeHtml(nextTrack.name || '未知歌曲')}</strong>
          ${reason ? `<small class="queue-reason" title="${escapeHtml(reason)}">${escapeHtml(reason)}</small>` : ''}
        </div>
        <em title="${escapeHtml(artist)}">${escapeHtml(artist || '未知歌手')}</em>
      </div>
      <span class="queue-empty">${escapeHtml(message)}</span>
    `;
  }

  function applyQueueCollapsed() {
    if (!queueStrip || !queueToggle) return;
    queueStrip.classList.toggle('collapsed', S.queueCollapsed);
    queueToggle.textContent = S.queueCollapsed ? 'SHOW' : 'HIDE';
    queueToggle.title = S.queueCollapsed ? '展开歌单' : '收起歌单';
    queueToggle.setAttribute('aria-expanded', String(!S.queueCollapsed));
  }

  function initQueueCollapse() {
    if (!queueToggle) return;
    try {
      localStorage.removeItem('claudio.queueCollapsed');
    } catch {}
    S.queueCollapsed = false;
    applyQueueCollapsed();
    queueToggle.onclick = () => {
      S.queueCollapsed = !S.queueCollapsed;
      applyQueueCollapsed();
    };
  }

  function showDailyBriefing(briefing) {
    if (!briefing?.text || briefing.key === S.dailyBriefingKey) return;
    S.dailyBriefingKey = briefing.key || briefing.text;
    typewriter(briefing.text);
    addBubble('dj', briefing.text);
  }

  async function refreshQueue() {
    try {
      const res = await fetch('/api/queue?limit=5');
      if (!res.ok) throw new Error(`queue ${res.status}`);
      const data = await res.json();
      renderQueue(data);
    } catch {
      try {
        const nowRes = await fetch('/api/now');
        const nowData = await nowRes.json();
        renderQueueFallback(nowData.next, '当前服务需重启后同步完整队列');
      } catch {
        renderQueueFallback(null, '队列暂时无法同步');
      }
    }
  }

  async function postQueueAction(url, body) {
    const options = { method: 'POST' };
    if (body) {
      options.headers = { 'Content-Type': 'application/json' };
      options.body = JSON.stringify(body);
    }
    const res = await fetch(url, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.reason || `request ${res.status}`);
    return data;
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
      if ('scene' in d || 'djPolicy' in d || d.queue?.recommendation) {
        S.settings = {
          ...(S.settings || {}),
          scene: d.scene ?? S.settings?.scene,
          effectiveScene: d.effectiveScene ?? S.settings?.effectiveScene,
          djPolicy: d.djPolicy ?? S.settings?.djPolicy,
          effectiveDjPolicy: d.effectiveDjPolicy ?? S.settings?.effectiveDjPolicy,
          timeStrategy: d.timeStrategy ?? S.settings?.timeStrategy,
          recommendation: d.queue?.recommendation
            ? { ...(S.settings?.recommendation || {}), ...d.queue.recommendation }
            : S.settings?.recommendation,
          scenes: S.settings?.scenes || []
        };
        renderStationStatus(S.settings);
      }
      if ('dailyBriefing' in d) showDailyBriefing(d.dailyBriefing);
    } else if (d.type === 'chat' && d.reply) {
      addBubble('dj', d.reply);
    } else if (d.type === 'queue' && d.queue) {
      renderQueue(d.queue);
      if (d.queue.recommendation) {
        S.settings = {
          ...(S.settings || {}),
          recommendation: { ...(S.settings?.recommendation || {}), ...d.queue.recommendation }
        };
        renderStationStatus(S.settings);
      }
    } else if (d.type === 'settings' && d.settings) {
      renderSettingsPanel(d.settings);
      if (d.queue) renderQueue(d.queue);
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

  async function reportPlaybackFailure(reason, detail = '') {
    try {
      const res = await fetch('/api/playback/failure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: S.track?.id,
          stage: 'client',
          reason,
          detail
        })
      });
      const data = await res.json().catch(() => ({}));
      if (data?.playbackNotice) showPlaybackNotice(data.playbackNotice);
    } catch {}
  }

  let nextRequestTrackId = null;
  function requestNextTrack(reason = '', skipReason = '', nextReason = '') {
    const trackId = S.track?.id || '';
    if (trackId && nextRequestTrackId === trackId) return Promise.resolve();
    nextRequestTrackId = trackId || '__unknown__';
    stopCurrentDjVoice(true);
    if (reason) addBubble('dj', reason);
    const options = { method: 'POST' };
    if (trackId || skipReason || nextReason) {
      options.headers = { 'Content-Type': 'application/json' };
      options.body = JSON.stringify({ skipReason, id: trackId, reason: nextReason });
    }
    return fetch('/api/next', options)
      .then((res) => res?.json?.())
      .then((data) => {
        if (data?.playbackNotice) showPlaybackNotice(data.playbackNotice);
        return data;
      })
      .catch(() => {})
      .finally(() => {
        if (nextRequestTrackId === (trackId || '__unknown__')) nextRequestTrackId = null;
      });
  }

  let playbackNoticeTimer = null;
  function showPlaybackNotice(message) {
    if (!playbackNotice || !message) return;
    playbackNotice.textContent = message;
    playbackNotice.classList.add('show');
    if (playbackNoticeTimer) clearTimeout(playbackNoticeTimer);
    playbackNoticeTimer = setTimeout(() => {
      playbackNotice.classList.remove('show');
    }, 4200);
  }

  // ─── Load track ────────────────────────────────────────────────────────────
  function loadTrack(track, userRequested = false) {
    const isDifferentTrack = !S.track || S.track.id !== track.id;
    if (isDifferentTrack) stopCurrentDjVoice(true);
    S.track = track;
    S.userRequested = userRequested;
    app.classList.remove('loading');
    updateSaveLocalButton();
    updateRemoveLocalButton();

    const artist  = artistOf(track);
    const album   = track.album?.name || track.al?.name || '';
    const picUrl  = track.album?.picUrl || track.al?.picUrl || '';

    songTitle.textContent  = track.name || '未知歌曲';
    songArtist.textContent = artist;
    songAlbum.textContent  = album;
    if (songReason) songReason.textContent = recommendationLabel(track);
    lastProgressAt = Date.now();
    lastProgressTime = 0;
    fill.style.width = '0%';
    tCur.textContent = '0:00';
    tEnd.textContent = '0:00';

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
  const PLAYBACK_STALL_MS = 20000;
  const TRIAL_CLIP_SKIP_LIMIT = 3;
  const TRIAL_CLIP_SKIP_WINDOW_MS = 45000;
  let lastProgressAt = Date.now();
  let lastProgressTime = 0;
  let trialClipSkips = [];

  function canAutoSkipTrialClip(now = Date.now()) {
    trialClipSkips = trialClipSkips.filter((ts) => now - ts < TRIAL_CLIP_SKIP_WINDOW_MS);
    if (trialClipSkips.length >= TRIAL_CLIP_SKIP_LIMIT) return false;
    trialClipSkips.push(now);
    return true;
  }

  function resetTrialClipSkips() {
    trialClipSkips = [];
  }

  function setPlaying(v) {
    S.playing = v;
    btnPlay.textContent = v ? 'Ⅱ' : '▶';
    if (stationStatus) stationStatus.textContent = v ? 'Playing...' : 'Standby';
    app.classList.toggle('playing', v);
    vinyl.classList.toggle('playing', v);
  }

  btnPlay.onclick = () => {
    if (audio.paused) { audio.play(); } else { audio.pause(); }
  };

  btnNext.onclick = () => requestNextTrack('', 'manual_skip');

  btnPrev.onclick = () => {
    if (audio.currentTime > 4) audio.currentTime = 0;
    // else: could implement previous track from history
  };

  if (btnLike) btnLike.onclick = () => sendFeedbackCommand('\u559c\u6b22\u8fd9\u9996');
  if (btnDislike) btnDislike.onclick = () => sendFeedbackCommand('\u5c11\u653e\u8fd9\u9996');
  if (btnSaveLocal) {
    btnSaveLocal.onclick = async () => {
      if (!S.track || S.track.recommendationSource !== 'external') return;
      btnSaveLocal.disabled = true;
      btnSaveLocal.textContent = 'BUSY';
      try {
        const res = await fetch('/api/local-pool/current', { method: 'POST' });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.reason || '保存失败');
        if (data.track) S.track = data.track;
        btnSaveLocal.textContent = data.added ? 'SAVED' : 'LOCAL';
        addBubble('dj', data.added ? `《${S.track.name}》已加入${data.playlistName}。` : `《${S.track.name}》已经在${data.playlistName}里。`);
      } catch (error) {
        btnSaveLocal.textContent = 'SAVE';
        addBubble('dj', error.message || '保存到本地歌单池失败。');
      } finally {
        updateSaveLocalButton();
      }
    };
  }

  if (btnRemoveLocal) {
    btnRemoveLocal.onclick = async () => {
      const source = S.track?.recommendationSource;
      if (!S.track || source === 'external' || source === 'removed') return;
      const name = S.track.name || '这首歌';
      btnRemoveLocal.disabled = true;
      btnRemoveLocal.textContent = 'BUSY';
      try {
        const res = await fetch('/api/local-pool/remove-current', { method: 'POST' });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.reason || '删除失败');
        addBubble('dj', `《${name}》已从本地歌单池删除，并会永久屏蔽。`);
        if (S.track) {
          S.track = {
            ...S.track,
            recommendationSource: 'removed',
            recommendationReason: '已从本地歌单池删除'
          };
        }
        if (data.queue) renderQueue(data.queue);
      } catch (error) {
        addBubble('dj', error.message || '从本地歌单池删除失败。');
      } finally {
        updateRemoveLocalButton();
      }
    };
  }

  audio.onended  = () => requestNextTrack('', '', 'ended');
  audio.onplay   = () => {
    lastProgressAt = Date.now();
    lastProgressTime = audio.currentTime || 0;
    setPlaying(true);
  };
  audio.onpause  = () => setPlaying(false);
  audio.onwaiting = audio.onstalled = () => {
    if (stationStatus && S.playing) stationStatus.textContent = 'Buffering...';
  };
  audio.oncanplay = () => {
    if (stationStatus && S.playing) stationStatus.textContent = 'Playing...';
  };

  // Skip Netease 30-second trial clips; QQ songs with VIP always play to end
  audio.onloadedmetadata = () => {
    const dur = audio.duration;
    const isQQ = S.track?.id?.startsWith?.('qq:');
    if (!isQQ && dur > 0 && dur <= 35) {
      if (!canAutoSkipTrialClip()) {
        console.warn('连续遇到网易云试听片段，暂停自动跳过');
        showPlaybackNotice('连续遇到试听片段，已暂停自动换歌，点下一首继续。');
        audio.pause();
        setPlaying(false);
        return;
      }
      console.warn(`Netease 试听片段（${Math.round(dur)}s），自动跳过`);
      requestNextTrack(`《${S.track?.name || '该歌曲'}》只有试听版，马上换下一首。`, '', 'trial_clip');
    } else {
      resetTrialClipSkips();
    }
  };

  audio.onerror = () => {
    if (S.userRequested) {
      // User explicitly asked for this song, so explain before letting them choose again.
      S.userRequested = false;
      const name = S.track?.name || '该歌曲';
      console.warn(`User-requested track failed: ${name}`);
      reportPlaybackFailure('client_error', 'user requested track failed');
      addBubble('dj', `《${name}》当前音源暂时打不开，可能是链接过期或平台临时限制。试试换一首？`);
      if (!S.chatOpen) {
        // Briefly open chat so user sees the message
        S.chatOpen = true;
        chat.style.display = 'block';
        btnChat.classList.add('active');
      }
    } else {
      console.warn('Audio error — requesting next track');
      reportPlaybackFailure('client_error', 'audio element error');
      requestNextTrack('', 'client_error', 'client_error');
    }
  };

  // ─── Progress bar ──────────────────────────────────────────────────────────
  audio.ontimeupdate = () => {
    if (!audio.duration) return;
    lastProgressAt = Date.now();
    lastProgressTime = audio.currentTime || 0;
    const pct = (audio.currentTime / audio.duration) * 100;
    fill.style.width = `${pct}%`;
    tCur.textContent = fmtTime(audio.currentTime);
    tEnd.textContent = fmtTime(audio.duration);
    if (S.lyricOpen) syncLyric();
  };

  setInterval(() => {
    if (!S.playing || audio.paused || !S.track || !audio.duration) return;
    const remaining = audio.duration - audio.currentTime;
    if (remaining <= 3) return;
    const current = audio.currentTime || 0;
    const hasProgress = Math.abs(current - lastProgressTime) > 0.25;
    if (hasProgress) {
      lastProgressAt = Date.now();
      lastProgressTime = current;
      return;
    }
    if (Date.now() - lastProgressAt > PLAYBACK_STALL_MS) {
      console.warn('Playback stalled — requesting next track');
      reportPlaybackFailure('stalled', `no progress for ${PLAYBACK_STALL_MS}ms`);
      requestNextTrack('', 'stalled', 'stalled');
    }
  }, 5000);

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

  if (btnSettings) {
    btnSettings.onclick = () => {
      S.settingsOpen = !S.settingsOpen;
      if (settingsPanel) settingsPanel.hidden = !S.settingsOpen;
      btnSettings.classList.toggle('active', S.settingsOpen);
      if (S.settingsOpen) {
        loadSettings();
        refreshAccountStatus();
        refreshQqLoginStatus();
        refreshNeteaseLoginStatus();
      }
    };
  }

  if (settingExternalEnabled) {
    settingExternalEnabled.onchange = () => {
      saveSettingsPatch({ externalEnabled: settingExternalEnabled.checked }).catch(() => {
        addBubble('dj', '设置暂时没有保存成功，稍后再试。');
      });
    };
  }

  if (settingExternalRatio) {
    settingExternalRatio.oninput = () => {
      if (settingRatioValue) settingRatioValue.textContent = ratioLabel(settingExternalRatio.value);
    };
    settingExternalRatio.onchange = () => {
      saveSettingsPatch({ externalRatio: Number(settingExternalRatio.value), externalEnabled: true }).catch(() => {
        addBubble('dj', '外部推荐比例暂时没有保存成功。');
      });
    };
  }

  if (settingDjPolicy) {
    settingDjPolicy.onchange = () => {
      saveSettingsPatch({ djPolicyMode: settingDjPolicy.value }).catch(() => {
        addBubble('dj', 'DJ 频率暂时没有保存成功。');
      });
    };
  }

  if (settingScene) {
    settingScene.onchange = () => {
      saveSettingsPatch({ sceneId: settingScene.value }).catch(() => {
        addBubble('dj', '默认场景暂时没有保存成功。');
      });
    };
  }

  if (memoryExport) memoryExport.onclick = downloadRadioMemory;
  if (memoryImport) {
    memoryImport.onclick = () => {
      if (memoryImportFile) memoryImportFile.click();
    };
  }
  if (memoryImportFile) {
    memoryImportFile.onchange = () => importRadioMemory(memoryImportFile.files?.[0]);
  }
  document.querySelectorAll('[data-sleep-minutes]').forEach((button) => {
    button.onclick = () => startSleepTimer(button.dataset.sleepMinutes);
  });
  if (sleepOff) sleepOff.onclick = cancelSleepTimer;
  if (alarmOn) alarmOn.onclick = startAlarmTimer;
  if (alarmOff) alarmOff.onclick = cancelAlarmTimer;
  if (blockedRefresh) blockedRefresh.onclick = loadBlockedTracks;
  if (blockedList) {
    blockedList.onclick = (event) => {
      const button = event.target.closest('[data-restore-key]');
      if (!button) return;
      button.disabled = true;
      restoreBlockedTrack(button.dataset.restoreKey).catch((error) => {
        button.disabled = false;
        showPlaybackNotice(error.message || '恢复失败');
      });
    };
  }
  if (qqLoginStart) qqLoginStart.onclick = startQqLogin;
  if (qqLoginCancel) qqLoginCancel.onclick = cancelQqLogin;
  if (neteaseLoginStart) neteaseLoginStart.onclick = startNeteaseLogin;
  if (neteaseLoginCancel) neteaseLoginCancel.onclick = cancelNeteaseLogin;
  if (qqLoginStatus) {
    refreshQqLoginStatus();
    setInterval(refreshQqLoginStatus, 5000);
  }

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
      if (data.queue) renderQueue(data.queue);
      if (data.djPolicy || data.explorationMode || typeof data.externalRatio === 'number') {
        loadSettings();
      }
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
      setQueueActionPending(queueRebuild, true, 'RESHUFFLE');
      renderQueueStatus('正在重新生成队列...');
      try {
        const data = await postQueueAction('/api/queue/rebuild');
        if (data.queue) renderQueue(data.queue);
        addBubble('dj', '队列已经重新生成。');
      } catch (error) {
        renderQueueStatus(`重新生成队列失败：${error.message || '稍后再试'}`);
        addBubble('dj', '重新生成队列失败，稍后再试。');
      } finally {
        setQueueActionPending(queueRebuild, false, 'RESHUFFLE');
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
    initQueueCollapse();
    loadSettings();
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
      if ('dailyBriefing' in data) showDailyBriefing(data.dailyBriefing);
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
