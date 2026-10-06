(async function scoredpRival() {
  'use strict';

  // 다국어 문자열
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
      header: 'scoredp 라이벌 스코어 수집',
      guide: '라이벌의 IIDX ID를 입력하세요.\nscoredp에 이미 등록된 사용자만 가능합니다.',
      placeholder: 'IIDX ID',
      start: '시작',
      invalidId: 'IIDX ID는 숫자 8자리여야 합니다.',
      checking: '서버에서 유저 확인 중...',
      notRegistered: '등록되지 않은 사용자입니다.',
      serverError: (msg) => `서버 오류: ${msg}`,
      searching: 'e-amusement에서 라이벌 검색 중...',
      notFound: '해당 IIDX ID를 찾을 수 없습니다.\n로그인 상태를 확인해 주세요.',
      searchError: (msg) => `검색 오류: ${msg}`,
      found: (id, name) => `IIDX ID: ${id}\nDJ NAME: ${name}`,
      collecting: (d, p, n) => `수집 중... (레벨 ${d}/12, ${p}페이지)\n수집된 곡: ${n}개`,
      noScores: '수집된 스코어가 없습니다.\n상대방의 공개 설정을 확인해 주세요.',
      uploading: (n) => `총 ${n}개 수집 완료.\n서버에 전송 중...`,
      uploadError: (msg) => `전송 오류: ${msg}`,
      done: (updated, total) => `완료!\n업데이트: ${updated}개 / 수집: ${total}개`,
      proceed: '진행',
      back: '이전',
      goToPage: '이동',
    },
    ja: {
      alreadyRunning: 'すでに実行中です。',
      noApiUrl: 'API URLを確認できません。',
      header: 'scoredp ライバルスコア収集',
      guide: 'ライバルのIIDX IDを入力してください。\nscoredpに登録済みのユーザーのみ利用できます。',
      placeholder: 'IIDX ID',
      start: '開始',
      invalidId: 'IIDX IDは数字8桁で入力してください。',
      checking: 'サーバーでユーザーを確認中...',
      notRegistered: '登録されていないユーザーです。',
      serverError: (msg) => `サーバーエラー: ${msg}`,
      searching: 'e-amusementでライバルを検索中...',
      notFound: '該当するIIDX IDが見つかりません。\nログイン状態をご確認ください。',
      searchError: (msg) => `検索エラー: ${msg}`,
      found: (id, name) => `IIDX ID: ${id}\nDJ NAME: ${name}`,
      collecting: (d, p, n) => `収集中... (レベル ${d}/12, ${p}ページ目)\n収集した曲数: ${n}曲`,
      noScores: '収集されたスコアがありません。\n相手の公開設定をご確認ください。',
      uploading: (n) => `合計${n}曲収集完了。\nサーバーに送信中...`,
      uploadError: (msg) => `送信エラー: ${msg}`,
      done: (updated, total) => `完了！\n更新: ${updated}件 / 収集: ${total}件`,
      proceed: '続行',
      back: '戻る',
      goToPage: 'ページへ',
    },
    en: {
      alreadyRunning: 'Already running.',
      noApiUrl: 'Could not determine the API URL.',
      header: 'scoredp rival score collector',
      guide: "Enter the rival's IIDX ID.\nOnly users already registered on scoredp are supported.",
      placeholder: 'IIDX ID',
      start: 'Start',
      invalidId: 'IIDX ID must be 8 digits.',
      checking: 'Checking the user on the server...',
      notRegistered: 'This user is not registered.',
      serverError: (msg) => `Server error: ${msg}`,
      searching: 'Searching for the rival on e-amusement...',
      notFound: 'Could not find this IIDX ID.\nPlease check your login status.',
      searchError: (msg) => `Search error: ${msg}`,
      found: (id, name) => `IIDX ID: ${id}\nDJ NAME: ${name}`,
      collecting: (d, p, n) => `Collecting... (level ${d}/12, page ${p})\nSongs collected: ${n}`,
      noScores: "No scores were collected.\nPlease check the rival's privacy settings.",
      uploading: (n) => `Collected ${n} songs.\nUploading to server...`,
      uploadError: (msg) => `Upload error: ${msg}`,
      done: (updated, total) => `Done!\nUpdated: ${updated} / Collected: ${total}`,
      proceed: 'Continue',
      back: 'Back',
      goToPage: 'View',
    },
  }[LOCALE];

  if (window._scoredpRvRunning) {
    alert(STR.alreadyRunning);
    return;
  }
  window._scoredpRvRunning = true;

  const API_BASE = (window._scoredpApiBase || '').replace(/\/$/, '');
  if (!API_BASE) {
    alert(STR.noApiUrl);
    window._scoredpRvRunning = false;
    return;
  }

  // 백엔드가 로컬이면 프론트도 로컬 주소로
  const FRONTEND_BASE = /localhost|127\./.test(API_BASE) ? 'http://localhost:3000' : 'https://scoredp.vercel.app';

  // Overlay UI
  document.getElementById('_scoredpRvOverlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = '_scoredpRvOverlay';
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
          <button class="_scoredpRvLang" data-locale="${l}" style="
            all:initial;cursor:pointer;
            color:${l === LOCALE ? '#1a73e8' : '#5f6368'};font:12px/1.6 sans-serif;
            font-weight:${l === LOCALE ? '600' : '400'};padding:0 4px;
          ">${l.toUpperCase()}</button>
        `).join('')}
        <button id="_scoredpRvRetry" style="
          all:initial;cursor:pointer;
          color:#5f6368;font:18px/1 sans-serif;display:none;padding:0 0 0 8px;
        ">⟳</button>
        <button id="_scoredpRvClose" style="
          all:initial;cursor:pointer;
          color:#5f6368;font:18px/1 sans-serif;padding:0 0 0 12px;
        ">✕</button>
      </div>
    </div>
    <div id="_scoredpRvMsg" style="color:#202124;margin-bottom:14px;font:14px/1.6 sans-serif;white-space:pre-line;word-break:break-all;"></div>
    <div id="_scoredpRvForm" style="display:flex;align-items:center;gap:8px;">
      <input id="_scoredpRvInput" type="text" inputmode="numeric" maxlength="9" placeholder="${STR.placeholder}" style="
        border:1px solid #dadce0;border-radius:8px;
        padding:8px 12px;font:14px/1.6 sans-serif;color:#202124;background:#fff;
        width:180px;box-sizing:border-box;
      ">
      <button id="_scoredpRvStart" style="
        all:initial;cursor:pointer;
        background:#1a73e8;color:#fff;border-radius:8px;
        padding:8px 18px;font:14px/1.6 sans-serif;font-weight:500;
        display:inline-block;
      ">${STR.start}</button>
    </div>
    <div id="_scoredpRvFooter"></div>
  `;

  document.body.appendChild(overlay);

  const msgEl = overlay.querySelector('#_scoredpRvMsg');
  const formEl = overlay.querySelector('#_scoredpRvForm');
  const inputEl = overlay.querySelector('#_scoredpRvInput');
  const startBtn = overlay.querySelector('#_scoredpRvStart');
  const footerEl = overlay.querySelector('#_scoredpRvFooter');
  const closeBtn = overlay.querySelector('#_scoredpRvClose');
  const retryBtn = overlay.querySelector('#_scoredpRvRetry');

  function closeOverlay() {
    overlay.remove();
    window._scoredpRvRunning = false;
  }

  closeBtn.addEventListener('click', closeOverlay);
  retryBtn.addEventListener('click', () => {
    closeOverlay();
    scoredpRival();
  });
  overlay.querySelectorAll('._scoredpRvLang').forEach(btn => {
    btn.addEventListener('click', () => {
      localStorage.setItem(LOCALE_KEY, btn.dataset.locale);
      closeOverlay();
      scoredpRival();
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
    formEl.style.display = 'none';
    retryBtn.style.display = '';
    console.error('[scoredp]', msg);
    window._scoredpRvRunning = false;
  }

  // IIDX ID 입력
  log(STR.guide);
  inputEl.focus();

  const targetId = await new Promise(resolve => {
    const submit = () => {
      const id = inputEl.value.replace(/\D/g, '');
      if (!/^\d{8}$/.test(id)) {
        log(STR.invalidId);
        return;
      }
      resolve(id);
    };
    startBtn.addEventListener('click', submit);
    inputEl.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
  });
  formEl.style.display = 'none';

  // 서버에 등록된 유저인지 확인
  log(STR.checking);
  try {
    const res = await fetch(`${API_BASE}/auth/status/${targetId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (!(await res.json()).dj_name) {
      logError(STR.notRegistered);
      return;
    }
  } catch (e) {
    logError(STR.serverError(e.message));
    return;
  }

  // e-amusement 검색 후 rival 코드를 얻어냄
  const IIDX_VERSION = 34;
  let rivalCode, djName;

  log(STR.searching);
  try {
    const res = await fetch(`/game/2dx/${IIDX_VERSION}/rival/rival_search.html`, {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `iidxid=${targetId}&mode=1`,
    });
    const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
    const link = doc.querySelector('#result a[href*="rival_status.html"]');
    rivalCode = link?.getAttribute('href').match(/[?&]rival=([^&#]+)/)?.[1];
    const foundId = link?.closest('tr').querySelectorAll('td')[1]?.textContent.replace(/\D/g, '');
    if (!rivalCode || foundId !== targetId) {
      logError(STR.notFound);
      return;
    }
    djName = link.textContent.trim();
  } catch (e) {
    logError(STR.searchError(e.message));
    return;
  }

  // 검색된 사용자가 맞는지 확인
  log(STR.found(targetId.replace(/(\d{4})(\d{4})/, '$1-$2'), djName));
  footerEl.innerHTML = `
    <button id="_scoredpRvConfirm" style="
      all:initial;cursor:pointer;
      background:#1a73e8;color:#fff;border-radius:8px;
      padding:8px 18px;font:14px/1.6 sans-serif;font-weight:500;
      display:inline-block;
    ">${STR.proceed}</button>
    <button id="_scoredpRvBack" style="
      all:initial;cursor:pointer;
      color:#5f6368;font:12px/1.6 sans-serif;text-decoration:underline;
      padding:8px 0;margin-left:12px;
      display:inline-block;
    ">${STR.back}</button>
  `;
  // 아니라면 오버레이를 다시 띄워 ID 입력 단계로 복귀
  footerEl.querySelector('#_scoredpRvBack').addEventListener('click', () => {
    closeOverlay();
    scoredpRival();
  });
  await new Promise(resolve => {
    footerEl.querySelector('#_scoredpRvConfirm').addEventListener('click', resolve, { once: true });
  });
  footerEl.innerHTML = '';

  // clflg → clear_type int
  // 0=NO PLAY, 1=FAILED, 2=ASSIST, 3=EASY, 4=NORMAL, 5=HARD, 6=EX_HARD, 7 = FULL_COMBO
  const CLFLG_TO_CLEAR_TYPE = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7 };

  const DELAY_MS = 750;

  async function fetchDoc(difficult, offset) {
    const url =
      `/game/2dx/${IIDX_VERSION}/djdata/music/difficulty_rival.html` +
      `?difficult=${difficult}&style=1&disp=1&offset=${offset}&rival=${rivalCode}`;
    const res = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    return new DOMParser().parseFromString(html, 'text/html');
  }

  function parsePage(doc) {
    const results = [];

    // 레벨을 헤더에서 파싱, "DP LEVEL 10" → 10
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

      const djLvImg = tds[2].querySelector('img');
      const djLvMatch = djLvImg?.src.match(/\/([^/]+)\.gif(?:[?#]|$)/);
      const djLevel = djLvMatch?.[1] ?? '---';

      const scoreNode = tds[3].firstChild;
      const score = parseInt((scoreNode?.nodeValue ?? '').trim()) || 0;

      const clearImg = tds[4].querySelector('img');
      const clflgMatch = clearImg?.src.match(/clflg(\d+)\.gif(?:[?#]|$)/);
      const clflgNum = clflgMatch ? parseInt(clflgMatch[1]) : 0;
      const clearType = CLFLG_TO_CLEAR_TYPE[clflgNum];
      if (!clearType) continue;

      results.push({ title, chart, level, clear_type: clearType, score, dj_level: djLevel });
    }

    return results;
  }

  // 크롤링 메인 루프
  const allScores = [];

  // 고레벨부터 역순으로 LEVEL 8까지
  for (let difficult = 11; difficult >= 7; difficult--) {
    let offset = 0;
    while (true) {
      log(STR.collecting(difficult + 1, offset / 50 + 1, allScores.length));

      let doc;
      try {
        doc = await fetchDoc(difficult, offset);
      } catch (e) {
        console.warn(`[scoredp] skip difficult=${difficult} offset=${offset}: ${e.message}`);
        break;
      }

      allScores.push(...parsePage(doc));

      if (!doc.querySelector('.navi-next a')) break;

      offset += 50;
      await new Promise(r => setTimeout(r, DELAY_MS));
    }

    await new Promise(r => setTimeout(r, DELAY_MS));
  }

  // 서버 전송
  if (allScores.length === 0) {
    logError(STR.noScores);
    return;
  }

  log(STR.uploading(allScores.length));

  let result;
  try {
    const res = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ iidx_id: targetId, dj_name: djName, scores: allScores }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    result = await res.json();
  } catch (e) {
    logError(STR.uploadError(e.message));
    return;
  }

  log(STR.done(result.updated, allScores.length));
  footerEl.innerHTML = `
    <button id="_scoredpRvGo" style="
      all:initial;cursor:pointer;
      background:#1a73e8;color:#fff;border-radius:8px;
      padding:8px 18px;font:14px/1.6 sans-serif;font-weight:500;
      display:inline-block;
    ">${STR.goToPage}</button>
  `;
  overlay.querySelector('#_scoredpRvGo').addEventListener('click', () => {
    window.open(`${FRONTEND_BASE}/scores?id=${targetId}`, '_blank');
  });
  window._scoredpRvRunning = false;
})();
