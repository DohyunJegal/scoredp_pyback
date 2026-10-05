(async function scoredpPassword() {
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
      header: 'scoredp 개인 배치 저장',
      fetchingInfo: '데이터를 가져오는 중...',
      loginRequired: '로그인이 필요합니다.\ne-amusement에 로그인한 뒤 다시 시도해 주세요.',
      cannotReadInfo: 'DJ NAME / IIDX ID를 읽을 수 없습니다.\n로그인 상태를 확인해 주세요.',
      genericError: (msg) => `오류: ${msg}`,
      passwordSetupLabel: (name) => `<b>${name}</b> 비밀번호 설정`,
      pwPlaceholder: '숫자 4자리',
      confirm: '확인',
      saving: '저장중...',
      pleaseEnter4Digits: '숫자 4자리를 입력해 주세요.',
      needCrawlerFirst: '먼저 크롤러를 실행해 스코어를 등록해 주세요.',
      pwSetSuccess: '비밀번호가 설정되었습니다!',
    },
    ja: {
      alreadyRunning: 'すでに実行中です。',
      noApiUrl: 'API URLを確認できません。',
      header: 'scoredp 個人配置保存',
      fetchingInfo: 'データを取得中...',
      loginRequired: 'ログインが必要です。\ne-amusementにログインしてから再度お試しください。',
      cannotReadInfo: 'DJ NAME / IIDX IDを読み取れません。\nログイン状態をご確認ください。',
      genericError: (msg) => `エラー: ${msg}`,
      passwordSetupLabel: (name) => `<b>${name}</b> のパスワード設定`,
      pwPlaceholder: '4桁の数字',
      confirm: '確認',
      saving: '保存中...',
      pleaseEnter4Digits: '4桁の数字を入力してください。',
      needCrawlerFirst: '先にクローラーを実行してスコアを登録してください。',
      pwSetSuccess: 'パスワードが設定されました！',
    },
    en: {
      alreadyRunning: 'Already running.',
      noApiUrl: 'Could not determine the API URL.',
      header: 'scoredp personal layout save',
      fetchingInfo: 'Fetching data...',
      loginRequired: 'Login required.\nPlease log in to e-amusement and try again.',
      cannotReadInfo: 'Could not read DJ NAME / IIDX ID.\nPlease check your login status.',
      genericError: (msg) => `Error: ${msg}`,
      passwordSetupLabel: (name) => `Set password for <b>${name}</b>`,
      pwPlaceholder: '4-digit number',
      confirm: 'Confirm',
      saving: 'Saving...',
      pleaseEnter4Digits: 'Please enter a 4-digit number.',
      needCrawlerFirst: 'Please run the crawler first to register your scores.',
      pwSetSuccess: 'Password set successfully!',
    },
  }[LOCALE];

  if (window._scoredpPwRunning) {
    alert(STR.alreadyRunning);
    return;
  }
  window._scoredpPwRunning = true;

  const thisScript =
    document.currentScript ||
    Array.from(document.scripts).reverse().find(s => s.src.includes('password.js'));
  const API_BASE = (
    window._scoredpApiBase ||
    thisScript?.getAttribute('data-api') ||
    (thisScript ? new URL(thisScript.src).origin : '')
  ).replace(/\/$/, '');

  if (!API_BASE) {
    alert(STR.noApiUrl);
    window._scoredpPwRunning = false;
    return;
  }

  // ── Overlay UI ──────────────────────────────────────────────────────────────

  // 이전 오버레이 제거
  document.getElementById('_scoredpPwOverlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = '_scoredpPwOverlay';
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
          <button class="_scoredpPwLang" data-locale="${l}" style="
            all:initial;cursor:pointer;
            color:${l === LOCALE ? '#1a73e8' : '#5f6368'};font:12px/1.6 sans-serif;
            font-weight:${l === LOCALE ? '600' : '400'};padding:0 4px;
          ">${l.toUpperCase()}</button>
        `).join('')}
        <button id="_scoredpPwRetry" style="
          all:initial;cursor:pointer;
          color:#5f6368;font:18px/1 sans-serif;display:none;padding:0 0 0 8px;
        ">⟳</button>
        <button id="_scoredpPwClose" style="
          all:initial;cursor:pointer;
          color:#5f6368;font:18px/1 sans-serif;padding:0 0 0 12px;
        ">✕</button>
      </div>
    </div>
    <div id="_scoredpPwBody" style="color:#202124;font-size:14px;"></div>
  `;

  document.body.appendChild(overlay);

  const bodyEl = overlay.querySelector('#_scoredpPwBody');
  const closeBtn = overlay.querySelector('#_scoredpPwClose');
  const retryBtn = overlay.querySelector('#_scoredpPwRetry');

  function closeOverlay() {
    overlay.remove();
    window._scoredpPwRunning = false;
  }

  closeBtn.addEventListener('click', closeOverlay);
  retryBtn.addEventListener('click', () => {
    closeOverlay();
    scoredpPassword();
  });
  overlay.querySelectorAll('._scoredpPwLang').forEach(btn => {
    btn.addEventListener('click', () => {
      localStorage.setItem(LOCALE_KEY, btn.dataset.locale);
      closeOverlay();
      scoredpPassword();
    });
  });

  function showError(msg) {
    bodyEl.innerHTML = `<div style="color:#d93025;white-space:pre-line;">${msg}</div>`;
    retryBtn.style.display = '';
    window._scoredpPwRunning = false;
  }

  bodyEl.textContent = STR.fetchingInfo;

  // ── 사용자 정보 자동 수집 ─────────────────────────────────────────────────────

  const IIDX_VERSION = 34;
  let iidxId, djName;

  try {
    // 최대 2회 재시도
    let statusRes;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt) await new Promise(r => setTimeout(r, 1500));
      statusRes = await fetch(
        `/game/2dx/${IIDX_VERSION}/djdata/status.html`,
        { credentials: 'same-origin', cache: 'no-store' }
      );
      if (!statusRes.url.includes('status.html')) break;

      // 원본 HTML에서 정규식으로 데이터 직접 추출
      const html = await statusRes.text();
      djName = html.match(/<td>\s*DJ NAME\s*<\/td>\s*<td>\s*([^<]+?)\s*<\/td>/)?.[1];
      iidxId = html.match(/<td>\s*IIDX ID\s*<\/td>\s*<td>\s*([^<]+?)\s*<\/td>/)?.[1];
      if (iidxId && djName) break;
    }

    if (!statusRes.url.includes('status.html')) {
      showError(STR.loginRequired);
      return;
    }

    if (!iidxId || !djName) {
      showError(STR.cannotReadInfo);
      return;
    }
  } catch (e) {
    showError(STR.genericError(e.message));
    return;
  }

  // ── 비밀번호 입력 폼 ─────────────────────────────────────────────────────────

  bodyEl.innerHTML = `
    <div style="margin-bottom:14px;">${STR.passwordSetupLabel(djName)}</div>
    <div style="display:flex;align-items:center;gap:8px;">
      <input
        id="_scoredpPwInput"
        type="text"
        inputmode="numeric"
        maxlength="4"
        placeholder="${STR.pwPlaceholder}"
        style="
          border:1px solid #dadce0;border-radius:8px;
          padding:8px 12px;font-size:15px;width:110px;
          outline:none;
        "
      />
      <button id="_scoredpPwConfirm" disabled style="
        background:#1a73e8;color:#fff;border:none;border-radius:8px;
        padding:8px 18px;font-size:14px;cursor:pointer;font-weight:500;
        opacity:0.4;
      ">${STR.confirm}</button>
    </div>
    <div id="_scoredpPwMsg" style="margin-top:8px;font-size:12px;color:#d93025;min-height:16px;"></div>
  `;

  const input = overlay.querySelector('#_scoredpPwInput');
  const confirmBtn = overlay.querySelector('#_scoredpPwConfirm');
  const msg = overlay.querySelector('#_scoredpPwMsg');

  input.focus();
  input.addEventListener('focus', () => input.style.borderColor = '#1a73e8');
  input.addEventListener('blur', () => input.style.borderColor = '#dadce0');
  input.addEventListener('input', () => {
    const ready = /^\d{4}$/.test(input.value);
    confirmBtn.disabled = !ready;
    confirmBtn.style.opacity = ready ? '1' : '0.4';
    confirmBtn.style.cursor = ready ? 'pointer' : 'default';
  });

  async function submit() {
    const pw = input.value.trim();
    if (!/^\d{4}$/.test(pw)) {
      msg.textContent = STR.pleaseEnter4Digits;
      input.focus();
      return;
    }

    confirmBtn.disabled = true;
    confirmBtn.textContent = STR.saving;
    msg.textContent = '';

    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ iidx_id: iidxId, password: pw }),
      });

      if (res.status === 404) {
        msg.style.color = '#d93025';
        msg.textContent = STR.needCrawlerFirst;
        confirmBtn.disabled = false;
        confirmBtn.style.opacity = '1';
        confirmBtn.textContent = STR.confirm;
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      msg.style.color = '#188038';
      msg.textContent = STR.pwSetSuccess;
      confirmBtn.disabled = false;
      confirmBtn.textContent = STR.confirm;
      input.value = '';
      confirmBtn.style.opacity = '0.4';
      confirmBtn.disabled = true;
    } catch (e) {
      msg.style.color = '#d93025';
      msg.textContent = STR.genericError(e.message);
      confirmBtn.disabled = false;
      confirmBtn.style.opacity = '1';
      confirmBtn.textContent = STR.confirm;
    }
  }

  confirmBtn.addEventListener('click', submit);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { submit(); return; }
    const allowed = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'];
    if (!allowed.includes(e.key) && !/^\d$/.test(e.key)) e.preventDefault();
  });
})();
