(async function scoredpCrawler() {
  'use strict';

  if (window._scoredpRunning) {
    alert('이미 실행 중입니다.');
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
    alert('API URL을 확인할 수 없습니다.');
    return;
  }

  // ── Overlay UI ──────────────────────────────────────────────────────────────

  const overlay = document.createElement('div');
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
      <span style="color:#5f6368;font:12px/1.6 sans-serif;">scoredp 스코어 수집</span>
      <button id="_scoredpClose" style="
        all:initial;cursor:pointer;
        color:#5f6368;font:18px/1 sans-serif;padding:0 0 0 12px;
      ">✕</button>
    </div>
    <div id="_scoredpMsg" style="color:#202124;margin-bottom:14px;font:14px/1.6 sans-serif;white-space:pre-line;word-break:break-all;"></div>
    <div id="_scoredpFooter">
      <button id="_scoredpStart" style="
        all:initial;cursor:pointer;
        background:#1a73e8;color:#fff;border-radius:8px;
        padding:8px 18px;font:14px/1.6 sans-serif;font-weight:500;
        display:inline-block;
      ">시작</button>
    </div>
  `;

  document.body.appendChild(overlay);

  const msgEl = overlay.querySelector('#_scoredpMsg');
  const footerEl = overlay.querySelector('#_scoredpFooter');
  const startBtn = overlay.querySelector('#_scoredpStart');
  const closeBtn = overlay.querySelector('#_scoredpClose');

  function closeOverlay() {
    overlay.remove();
    window._scoredpRunning = false;
  }

  closeBtn.addEventListener('click', closeOverlay);

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
    console.error('[scoredp]', msg);
    window._scoredpRunning = false;
  }

  // ── 사용자 정보 자동 수집 ─────────────────────────────────────────────────────

  const IIDX_VERSION = 33;

  let iidxId, djName;
  try {
  const statusRes = await fetch(
      `/game/2dx/${IIDX_VERSION}/djdata/status.html`,
      { credentials: 'same-origin' }
    );

    // 로그인하지 않으면 로그인 페이지로 리다이렉트됨
    if (!statusRes.url.includes('status.html')) {
      logError('로그인이 필요합니다.\ne-amusement에 로그인한 뒤 다시 시도해 주세요.');
      return;
    }

    const html = await statusRes.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');

    // .dj-profile 테이블에서 DJ NAME / IIDX ID 파싱
    const profileTable = doc.querySelector('.dj-status .dj-profile table');
    if (!profileTable) {
      logError('로그인이 필요합니다.\ne-amusement에 로그인한 뒤 다시 시도해 주세요.');
      return;
    }

    for (const row of profileTable.querySelectorAll('tr')) {
      const cells = row.querySelectorAll('td');
      if (cells.length < 2) continue;
      const key = cells[0].textContent.trim();
      const val = cells[1].textContent.trim();
      if (key === 'DJ NAME') djName = val;
      if (key === 'IIDX ID') iidxId = val;
    }

    if (!iidxId || !djName) {
      logError('DJ NAME / IIDX ID를 읽을 수 없습니다.\n로그인 상태를 확인해 주세요.');
      return;
    }
  } catch (e) {
    logError(`사용자 정보 수집 오류: ${e.message}`);
    return;
  }


  log(`IIDX ID: ${iidxId}\nDJ NAME: ${djName}`);

  await new Promise(resolve => {
    startBtn.addEventListener('click', () => {
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
      log(`수집 중... (레벨 ${difficult}/12, ${offset/50+1}페이지)\n수집된 곡: ${allScores.length}개`);

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
    log('수집된 스코어가 없습니다.');
    closeBtn.style.display = '';
    return;
  }

  log(`총 ${allScores.length}개 수집 완료.\n서버에 전송 중...`);

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
    logError(`전송 오류: ${e.message}`);
    return;
  }

  log(`완료!\n업데이트: ${result.updated}개 / 수집: ${allScores.length}개`);
  closeBtn.style.display = '';
  window._scoredpRunning = false;
})();