(async function scoredpPassword() {
  'use strict';

  if (window._scoredpPwRunning) {
    alert('이미 실행 중입니다.');
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
    alert('API URL을 확인할 수 없습니다.');
    window._scoredpPwRunning = false;
    return;
  }

  // 사용자 정보 파싱
  const IIDX_VERSION = 33;
  let iidxId, djName;

  try {
    const statusRes = await fetch(
      `/game/2dx/${IIDX_VERSION}/djdata/status.html`,
      { credentials: 'same-origin' }
    );

    if (!statusRes.url.includes('status.html')) {
      alert('로그인이 필요합니다.\ne-amusement에 로그인한 뒤 다시 시도해 주세요.');
      window._scoredpPwRunning = false;
      return;
    }

    const html = await statusRes.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const profileTable = doc.querySelector('.dj-status .dj-profile table');
    if (!profileTable) {
      alert('로그인이 필요합니다.\ne-amusement에 로그인한 뒤 다시 시도해 주세요.');
      window._scoredpPwRunning = false;
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
      alert('DJ NAME / IIDX ID를 읽을 수 없습니다.');
      window._scoredpPwRunning = false;
      return;
    }
  } catch (e) {
    alert(`오류: ${e.message}`);
    window._scoredpPwRunning = false;
    return;
  }

  // ── 상단 오버레이 UI ─────────────────────────────────────────────────────────

  const card = document.createElement('div');
  card.style.cssText = [
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

  card.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;font-size:0;">
      <span style="color:#5f6368;font:12px/1.6 sans-serif;">scoredp 개인 배치 저장</span>
      <button id="_scoredpPwCancel" style="
        all:initial;cursor:pointer;
        color:#5f6368;font:18px/1 sans-serif;padding:0 0 0 12px;
      ">✕</button>
    </div>
    <div style="color:#202124;font-size:14px;margin-bottom:14px;">
      <b>${djName}</b> 비밀번호 설정
    </div>
    <div style="display:flex;align-items:center;gap:8px;">
      <input
        id="_scoredpPwInput"
        type="text"
        inputmode="numeric"
        maxlength="4"
        placeholder="숫자 4자리"
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
      ">확인</button>
    </div>
    <div id="_scoredpPwMsg" style="margin-top:8px;font-size:12px;color:#d93025;min-height:16px;"></div>
  `;

  document.body.appendChild(card);

  const input = card.querySelector('#_scoredpPwInput');
  const confirmBtn = card.querySelector('#_scoredpPwConfirm');
  const cancelBtn = card.querySelector('#_scoredpPwCancel');
  const msg = card.querySelector('#_scoredpPwMsg');

  input.focus();
  input.addEventListener('focus', () => input.style.borderColor = '#1a73e8');
  input.addEventListener('blur', () => input.style.borderColor = '#dadce0');
  input.addEventListener('input', () => {
    const ready = /^\d{4}$/.test(input.value);
    confirmBtn.disabled = !ready;
    confirmBtn.style.opacity = ready ? '1' : '0.4';
    confirmBtn.style.cursor = ready ? 'pointer' : 'default';
  });

  function close() {
    card.remove();
    window._scoredpPwRunning = false;
  }

  cancelBtn.addEventListener('click', close);

  async function submit() {
    const pw = input.value.trim();
    if (!/^\d{4}$/.test(pw)) {
      msg.textContent = '숫자 4자리를 입력해 주세요.';
      input.focus();
      return;
    }

    confirmBtn.disabled = true;
    confirmBtn.textContent = '저장중...';
    msg.textContent = '';

    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ iidx_id: iidxId, password: pw }),
      });

      if (res.status === 404) {
        msg.style.color = '#d93025';
        msg.textContent = '먼저 크롤러를 실행해 스코어를 등록해 주세요.';
        confirmBtn.disabled = false;
        confirmBtn.style.opacity = '1';
        confirmBtn.textContent = '확인';
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      msg.style.color = '#188038';
      msg.textContent = '비밀번호가 설정되었습니다!';
      confirmBtn.disabled = false;
      confirmBtn.textContent = '확인';
      input.value = '';
      confirmBtn.style.opacity = '0.4';
      confirmBtn.disabled = true;
    } catch (e) {
      msg.style.color = '#d93025';
      msg.textContent = `오류: ${e.message}`;
      confirmBtn.disabled = false;
      confirmBtn.style.opacity = '1';
      confirmBtn.textContent = '확인';
    }
  }

  confirmBtn.addEventListener('click', submit);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { submit(); return; }
    const allowed = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'];
    if (!allowed.includes(e.key) && !/^\d$/.test(e.key)) e.preventDefault();
  });
})();