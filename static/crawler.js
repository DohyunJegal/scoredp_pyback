(async function scoredpCrawler() {
  'use strict';

  // ── 다국어 문자열 ────────────────────
  const LOCALE_KEY = 'scoredp_locale';
  const LOCALE = (() => {
    const saved = localStorage.getItem(LOCALE_KEY);
    if (saved === 'ko' || saved === 'ja' || saved === 'en') return saved;
    const lang = (navigator.language || 'ko').toLowerCase();
    if (lang.startsWith('ja')) return 'ja';
    if (lang.startsWith('en')) return 'en';
    return 'ko';
  })();

  const STR = {
    ko: {
      alreadyRunning: '이미 실행 중입니다.',
      noApiUrl: 'API URL을 확인할 수 없습니다.',
      header: 'scoredp 스코어 수집',
      start: '시작',
      legacyLabel: (v) => `IIDX ${v} 데이터 사용`,
      fetchingInfo: '데이터를 가져오는 중...',
      loginRequired: '로그인이 필요합니다.\ne-amusement에 로그인한 뒤 다시 시도해 주세요.',
      cannotReadInfo: 'DJ NAME / IIDX ID를 읽을 수 없습니다.\n로그인 상태를 확인해 주세요.',
      infoError: (msg) => `사용자 정보 수집 오류: ${msg}`,
      infoResult: (id, name) => `IIDX ID: ${id}\nDJ NAME: ${name}`,
      collecting: (d, p, n) => `수집 중... (레벨 ${d}/12, ${p}페이지)\n수집된 곡: ${n}개`,
      noScores: '수집된 스코어가 없습니다.',
      uploading: (n) => `총 ${n}개 수집 완료.\n서버에 전송 중...`,
      uploadError: (msg) => `전송 오류: ${msg}`,
      done: (updated, total) => `완료!\n업데이트: ${updated}개 / 수집: ${total}개`,
      goToPage: '이동',
    },
    ja: {
      alreadyRunning: 'すでに実行中です。',
      noApiUrl: 'API URLを確認できません。',
      header: 'scoredp スコア収集',
      start: '開始',
      legacyLabel: (v) => `IIDX ${v} のデータを使用`,
      fetchingInfo: 'データを取得中...',
      loginRequired: 'ログインが必要です。\ne-amusementにログインしてから再度お試しください。',
      cannotReadInfo: 'DJ NAME / IIDX IDを読み取れません。\nログイン状態をご確認ください。',
      infoError: (msg) => `ユーザー情報取得エラー: ${msg}`,
      infoResult: (id, name) => `IIDX ID: ${id}\nDJ NAME: ${name}`,
      collecting: (d, p, n) => `収集中... (レベル ${d}/12, ${p}ページ目)\n収集した曲数: ${n}曲`,
      noScores: '収集されたスコアがありません。',
      uploading: (n) => `合計${n}曲収集完了。\nサーバーに送信中...`,
      uploadError: (msg) => `送信エラー: ${msg}`,
      done: (updated, total) => `完了！\n更新: ${updated}件 / 収集: ${total}件`,
      goToPage: 'ページへ',
    },
    en: {
      alreadyRunning: 'Already running.',
      noApiUrl: 'Could not determine the API URL.',
      header: 'scoredp score collector',
      start: 'Start',
      legacyLabel: (v) => `Use IIDX ${v} data`,
      fetchingInfo: 'Fetching data...',
      loginRequired: 'Login required.\nPlease log in to e-amusement and try again.',
      cannotReadInfo: 'Could not read DJ NAME / IIDX ID.\nPlease check your login status.',
      infoError: (msg) => `Error fetching user info: ${msg}`,
      infoResult: (id, name) => `IIDX ID: ${id}\nDJ NAME: ${name}`,
      collecting: (d, p, n) => `Collecting... (level ${d}/12, page ${p})\nSongs collected: ${n}`,
      noScores: 'No scores were collected.',
      uploading: (n) => `Collected ${n} songs.\nUploading to server...`,
      uploadError: (msg) => `Upload error: ${msg}`,
      done: (updated, total) => `Done!\nUpdated: ${updated} / Collected: ${total}`,
      goToPage: 'View',
    },
  }[LOCALE];

  if (window._scoredpRunning) {
    alert(STR.alreadyRunning);
    return;
  }
  window._scoredpRunning = true;

  // API base URL 우선순위:
  //   1) window._scoredpApiBase  (콘솔 직접 실행 시 수동 지정)
  //   2) 스크립트 태그의 data-api  (북마클릿 방식)
  //   3) 스크립트 src의 origin
  const thisScript =
    document.currentScript ||
    Array.from(document.scripts).reverse().find(s => s.src.includes('crawler.js'));
  const API_BASE = (
    window._scoredpApiBase ||
    thisScript?.getAttribute('data-api') ||
    (thisScript ? new URL(thisScript.src).origin : '')
  ).replace(/\/$/, '');

  if (!API_BASE) {
    alert(STR.noApiUrl);
    return;
  }

  // 백엔드가 로컬이면 프론트도 로컬 주소로
  const FRONTEND_BASE = /localhost|127\./.test(API_BASE) ? 'http://localhost:3000' : 'https://scoredp.vercel.app';

  // ── Overlay UI ──────────────────────────────────────────────────────────────

  // 이전 오버레이 제거
  document.getElementById('_scoredpOverlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = '_scoredpOverlay';
  overlay.style.cssText = [
    'all:initial',
    'display:block',
    'position:fixed', 'top:16px', 'left:16px', 'right:16px',
    'background:#fff',
    'border:1px solid #dadce0',
    'border-radius:12px',
    'box-shadow:0 2px 12px rgba(0,0,0,0.15)',
    'padding:16px 20px',
    'font:14px/1.6 sans-serif',
    'z-index:2147483647',
    'box-sizing:border-box',
  ].join(';');

  overlay.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;font-size:0;">
      <span style="color:#5f6368;font:12px/1.6 sans-serif;">${STR.header}</span>
      <div>
        ${['ko', 'ja', 'en'].map(l => `
          <button class="_scoredpLang" data-locale="${l}" style="
            all:initial;cursor:pointer;
            color:${l === LOCALE ? '#1a73e8' : '#5f6368'};font:12px/1.6 sans-serif;
            font-weight:${l === LOCALE ? '600' : '400'};padding:0 4px;
          ">${l.toUpperCase()}</button>
        `).join('')}
        <button id="_scoredpRetry" style="
          all:initial;cursor:pointer;
          color:#5f6368;font:18px/1 sans-serif;display:none;padding:0 0 0 8px;
        ">⟳</button>
        <button id="_scoredpClose" style="
          all:initial;cursor:pointer;
          color:#5f6368;font:18px/1 sans-serif;padding:0 0 0 12px;
        ">✕</button>
      </div>
    </div>
    <div id="_scoredpMsg" style="color:#202124;margin-bottom:14px;font:14px/1.6 sans-serif;white-space:pre-line;word-break:break-all;"></div>
    <div id="_scoredpFooter">
      <button id="_scoredpStart" style="
        all:initial;cursor:pointer;
        background:#1a73e8;color:#fff;border-radius:8px;
        padding:8px 18px;font:14px/1.6 sans-serif;font-weight:500;
        display:inline-block;
      ">${STR.start}</button>
      <button id="_scoredpStartLegacy" style="
        all:initial;cursor:pointer;
        color:#5f6368;font:12px/1.6 sans-serif;text-decoration:underline;
        padding:8px 0;margin-left:12px;
        display:inline-block;
      "></button>
    </div>
  `;

  document.body.appendChild(overlay);

  const msgEl = overlay.querySelector('#_scoredpMsg');
  const footerEl = overlay.querySelector('#_scoredpFooter');
  const startBtn = overlay.querySelector('#_scoredpStart');
  const startLegacyBtn = overlay.querySelector('#_scoredpStartLegacy');
  const closeBtn = overlay.querySelector('#_scoredpClose');
  const retryBtn = overlay.querySelector('#_scoredpRetry');

  // 사용자 정보 확인 전까지 시작 버튼 숨김
  footerEl.style.display = 'none';

  function closeOverlay() {
    overlay.remove();
    window._scoredpRunning = false;
  }

  closeBtn.addEventListener('click', closeOverlay);
  retryBtn.addEventListener('click', () => {
    closeOverlay();
    scoredpCrawler();
  });
  overlay.querySelectorAll('._scoredpLang').forEach(btn => {
    btn.addEventListener('click', () => {
      localStorage.setItem(LOCALE_KEY, btn.dataset.locale);
      closeOverlay();
      scoredpCrawler();
    });
  });

  function log(msg) {
    overlay.style.borderColor = '#dadce0';
    msgEl.style.color = '#202124';
    msgEl.textContent = msg;
    console.log('[scoredp]', msg);
  }

  function logError(msg) {
    overlay.style.borderColor = '#d93025';
    msgEl.style.color = '#d93025';
    msgEl.textContent = msg;
    footerEl.style.display = 'none';
    closeBtn.style.display = '';
    retryBtn.style.display = '';
    console.error('[scoredp]', msg);
    window._scoredpRunning = false;
  }

  // ── 사용자 정보 자동 수집 ─────────────────────────────────────────────────────

  let IIDX_VERSION = 34;
  startLegacyBtn.textContent = STR.legacyLabel(IIDX_VERSION - 1);

  log(STR.fetchingInfo);

  let iidxId, djName;
  try {
  const statusRes = await fetch(
      `/game/2dx/${IIDX_VERSION}/djdata/status.html`,
      { credentials: 'same-origin' }
    );

    // 로그인하지 않은 경우
    if (!statusRes.url.includes('status.html')) {
      logError(STR.loginRequired);
      return;
    }

    const html = await statusRes.text();

    // 원본 HTML에서 정규식으로 데이터 직접 추출
    const djNameMatch = html.match(/<td>\s*DJ NAME\s*<\/td>\s*<td>\s*([^<]+?)\s*<\/td>/);
    const iidxIdMatch = html.match(/<td>\s*IIDX ID\s*<\/td>\s*<td>\s*([^<]+?)\s*<\/td>/);
    djName = djNameMatch?.[1];
    iidxId = iidxIdMatch?.[1];

    if (!iidxId || !djName) {
      logError(STR.cannotReadInfo);
      return;
    }
  } catch (e) {
    logError(STR.infoError(e.message));
    return;
  }

  log(STR.infoResult(iidxId, djName));
  footerEl.style.display = '';

  await new Promise(resolve => {
    startBtn.addEventListener('click', () => {
      footerEl.style.display = 'none';
      closeBtn.style.display = 'none';
      resolve();
    }, { once: true });
    startLegacyBtn.addEventListener('click', () => {
      IIDX_VERSION = IIDX_VERSION - 1;
      footerEl.style.display = 'none';
      closeBtn.style.display = 'none';
      resolve();
    }, { once: true });
  });

  // ── clflg → clear_type int ───────────────────────────────────────────────────
  // 0=미플레이(skip), 1=FAILED, 2=ASSIST, 3=EASY, 4=NORMAL, 5=HARD, 6=EX_HARD, 7=FC
  const CLFLG_TO_CLEAR_TYPE = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7 };

  const DELAY_MS = 400;

  // ── Fetch helpers ────────────────────────────────────────────────────────────

  async function fetchDoc(difficult, offset) {
    const url =
      `/game/2dx/${IIDX_VERSION}/djdata/music/difficulty.html` +
      `?difficult=${difficult}&style=1&disp=1&offset=${offset}`;
    const res = await fetch(url, { credentials: 'same-origin' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    return new DOMParser().parseFromString(html, 'text/html');
  }

  // ── 페이지 파싱 ──────────────────────────────────────────────────────────────

  function parsePage(doc) {
    const results = [];

    // 레벨을 헤더에서 파싱: "DP LEVEL 10" → 10
    const th = doc.querySelector('.series-difficulty table th');
    const levelMatch = th?.textContent.match(/LEVEL\s+(\d+)/i);
    if (!levelMatch) return results;
    const level = parseInt(levelMatch[1]);

    const rows = doc.querySelectorAll('.series-difficulty table tbody tr');
    for (const row of rows) {
      const tds = row.querySelectorAll('td');
      if (tds.length < 5) continue;

      const anchor = tds[0].querySelector('a.music_info');
      if (!anchor) continue;

      const title = anchor.textContent.trim();
      const chart = tds[1].textContent.trim();
      if (chart === 'NORMAL') continue;

      // DJ 레벨: 이미지 파일명 (예: "AA", "AAA", "F")
      const djLvImg = tds[2].querySelector('img');
      const djLvMatch = djLvImg?.src.match(/\/([^/]+)\.gif(?:[?#]|$)/);
      const djLevel = djLvMatch?.[1] ?? '---';

      // 스코어: <br> 앞의 첫 번째 텍스트 노드
      const scoreNode = tds[3].firstChild;
      const score = parseInt((scoreNode?.nodeValue ?? '').trim()) || 0;

      // 클리어 타입: clflgN.gif
      const clearImg = tds[4].querySelector('img');
      const clflgMatch = clearImg?.src.match(/clflg(\d+)\.gif(?:[?#]|$)/);
      const clflgNum = clflgMatch ? parseInt(clflgMatch[1]) : 0;
      const clearType = CLFLG_TO_CLEAR_TYPE[clflgNum];
      if (!clearType) continue; // 미플레이 또는 알 수 없는 플래그

      results.push({ title, chart, level, clear_type: clearType, score, dj_level: djLevel });
    }

    return results;
  }

  // ── 크롤링 메인 루프 ─────────────────────────────────────────────────────────

  const allScores = [];

  for (let difficult = 0; difficult <= 12; difficult++) {
    let offset = 0;
    while (true) {
      log(STR.collecting(difficult, offset / 50 + 1, allScores.length));

      let doc;
      try {
        doc = await fetchDoc(difficult, offset);
      } catch (e) {
        console.warn(`[scoredp] skip difficult=${difficult} offset=${offset}: ${e.message}`);
        break;
      }

      const songs = parsePage(doc);
      allScores.push(...songs);

      const hasNext = !!doc.querySelector('.navi-next a');
      if (!hasNext) break;

      offset += 50;
      await new Promise(r => setTimeout(r, DELAY_MS));
    }

    await new Promise(r => setTimeout(r, DELAY_MS));
  }

  // ── 서버에 전송 ──────────────────────────────────────────────────────────────

  if (allScores.length === 0) {
    log(STR.noScores);
    closeBtn.style.display = '';
    return;
  }

  log(STR.uploading(allScores.length));

  let result;
  try {
    const res = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ iidx_id: iidxId, dj_name: djName, scores: allScores }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    result = await res.json();
  } catch (e) {
    logError(STR.uploadError(e.message));
    return;
  }

  log(STR.done(result.updated, allScores.length));
  footerEl.innerHTML = `
    <button id="_scoredpGo" style="
      all:initial;cursor:pointer;
      background:#1a73e8;color:#fff;border-radius:8px;
      padding:8px 18px;font:14px/1.6 sans-serif;font-weight:500;
      display:inline-block;
    ">${STR.goToPage}</button>
  `;
  footerEl.style.display = '';
  overlay.querySelector('#_scoredpGo').addEventListener('click', () => {
    window.open(`${FRONTEND_BASE}/scores?id=${iidxId.replace(/-/g, '')}`, '_blank');
  });
  closeBtn.style.display = '';
  window._scoredpRunning = false;
})();
