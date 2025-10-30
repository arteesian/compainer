// scriptVIPTABLO.js

// ---------- DOM ----------
const inputID      = document.querySelector('.wager-window-id-client-input input');
const btnCheck     = document.querySelector('.button-wager-vip');

const outEuro      = document.getElementById('vip-tablo-wager-response');  // "euro_bonus"
const outSorry     = document.getElementById('vip-tablo-sorry-response');  // "sorry_bonus"

const btnCopy      = document.getElementById('vip-tablo-copy');   // копировать euro_bonus
const btnAccrue    = document.getElementById('vip-tablo-accrue'); // показывать если have_bonus === true

// по умолчанию — скрыть
btnCopy  && btnCopy.classList.add('hidden');
btnAccrue && btnAccrue.classList.add('hidden');


// ---------- helpers ----------
const escapeHtml = s => String(s ?? '')
  .replaceAll('&','&amp;').replaceAll('<','&lt;')
  .replaceAll('>','&gt;').replaceAll('"','&quot;')
  .replaceAll("'", '&#39;');

const fmt = n => (n === null || n === undefined || isNaN(Number(n)))
  ? '—'
  : Number(n).toLocaleString('ru-RU');


const EURO_COPY_ALIASES = {
  'доступен евробонус 10000':
  ', для вас доступна акция, по которой вы можете получить бонус до 10 000 рублей.\n\nКак это работает:\n— Пополните счёт на сумму от 5 000 до 10 000 ₽ — мы начислим вам 100% этой суммы на бонусный счёт.\n— Чтобы перевести бонус на основной счёт, нужно сделать ставки на спортивные события с коэффициентом от 1.5.\n— Отыграть бонус нужно в 5-кратном размере в течение 7 дней с момента его получения.\n\nХотите участвовать? Просто сообщите нам!\nПодробные условия: https://pari.ru/pages/eurobonus_5k_10k',
  'доступен евробонус 30000':  ', для вас сейчас действует акция с возможностью получить до 30 000 рублей на основной счёт.\n\nУсловия участия:\n— Пополните счёт на сумму от 10 000 до 30 000 ₽\n— на бонусный счёт будет начислен 100% бонус.\n— Чтобы перевести бонус на основной счёт, заключайте пари на любые спортивные события с коэффициентом от 1.5./\n— Бонус необходимо отыграть в 5-кратном размере в течение 7 дней с момента начисления.\n\nЕсли хотите подключиться к акции — просто дайте знать! Подробнее об условиях: https://pari.ru/pages/eurobonus_10k_30k',
  'доступен евробонус 50000':  ', могу предложить вам бонус до 50 000 рублей!\n\nУсловия участия:\n— Пополните счёт на сумму от 10 000 до 50 000 ₽ в течение 7 дней — и получите бонус 100% от депозита на бонусный счёт.\n— Чтобы перевести бонус на основной счёт, необходимо сделать ставки на любые спортивные события с коэффициентом от 1.5, на сумму, превышающую бонус в 5 раз.\n— Все условия нужно выполнить в течение 7 дней.\n\n🔗 Подробнее: https://pari.ru/pages/eurobonus_10k_50k\n\nХотите принять участие? ',
};

function makeCopyTextFromEuro(rawText){
  const norm = String(rawText).toLowerCase().replace(/\s+/g,' ').trim();
  return EURO_COPY_ALIASES[norm] || rawText.trim();
}

// рендер евро-бонуса
function renderEuro(eb) {
  if (!eb) return `<div>Нет данных по евробонусу</div>`;
  if (eb.data === 'error') {
    return `<div>Ошибка: ${escapeHtml(String(eb.details ?? ''))}</div>`;
  }
  const hasOffer = (typeof eb.has_offer === 'boolean') ? eb.has_offer : null;
  const answer   = eb.euro_bonus_answer ? String(eb.euro_bonus_answer) : null;

  let html = `<div class="vip-euro-bonus">`;
  if (answer)            html += `${escapeHtml(answer)}<br>`;
  if (!hasOffer && !answer) html += `Данных нет<br>`;
  html += `</div>`;
  return html;
}

// рендер сорри-бонуса
function renderSorry(sb) {
  if (!sb) return `<div>Нет данных по сорри-бонусу</div>`;
  if (sb.data === 'error') {
    return `<div>Ошибка: ${escapeHtml(String(sb.details ?? ''))}</div>`;
  }
  const d = sb.data || {};
  let html = `<div class="vip-sorry-bonus">`;
  if (d.have_bonus) {
    html += `<div class="client-have-bonus-vip">Доступен фрибет<br>${fmt(d.sum_bn)} ₽</div>`;
  } else {
    html += `<div class="dont-have-sorry-vip">Фрибета нет</div>`;
  }
  html += `</div>`;
  return html;
}

// показать / скрыть кнопку копирования (по евробонусу)
function toggleCopyVisibility(eb) {
  btnCopy?.classList.toggle('hidden', eb?.has_offer !== true);
}

// показать / скрыть кнопку "Начислить" (по сорри-бонусу)
function toggleAccrueVisibility(sb) {
  if (!btnAccrue) return;
  const show = !!(sb && sb.data && sb.data.have_bonus === true);
  btnAccrue.classList.toggle('hidden', !show);
}


// ---------- actions ----------
async function sendRequest() {
  const id = (inputID?.value ?? '').trim();

  if (!/^\d{8}$/.test(id)) {
    outEuro.innerHTML  = `<span style="color:#e37;">Введите ID из 8 цифр</span>`;
    outSorry.innerHTML = ``;
    btnCopy  && btnCopy.classList.add('hidden');
    btnAccrue && btnAccrue.classList.add('hidden');
    inputID && inputID.focus();
    return;
  }

  const oldBtnText = btnCheck?.textContent;
  if (btnCheck) {
    btnCheck.disabled = true;
    btnCheck.textContent = 'Проверяю…';
  }
  outEuro.innerHTML  = '<div class="wait-euro-vip"><img src="/static/img/dotsv2.gif"></div>';
  outSorry.innerHTML = '<div class="wait-sorry-vip"><img src="/static/img/dotsv2.gif"></div>';
  btnCopy  && btnCopy.classList.add('hidden');
  btnAccrue && btnAccrue.classList.add('hidden');

  try {
    const res = await fetch('/api/v1/sorry_bonus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // если используется cookie-сессия
      body: JSON.stringify({ client_id: id })
    });

    if (res.status === 401) {
      outEuro.innerHTML  = 'Вы не авторизованы. <a href="/auth/login/google">Войти через Google</a>';
      outSorry.innerHTML = '';
      return;
    }

    if (res.status === 422) {
      const e = await res.json().catch(() => ({}));
      const msg = e?.details || 'Некорректный номер счёта.';
      outEuro.textContent  = msg;
      outSorry.textContent = '';
      return;
    }

    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      const msg = e?.detail?.message || e?.detail || `Ошибка: HTTP ${res.status}`;
      outEuro.textContent  = msg;
      outSorry.textContent = '';
      return;
    }

    const data = await res.json();

    // рендерим отдельно
    outEuro.innerHTML  = renderEuro(data?.euro_bonus);
    outSorry.innerHTML = renderSorry(data?.sorry_bonus);

    // управляем кнопками
    toggleCopyVisibility(data?.euro_bonus);
    toggleAccrueVisibility(data?.sorry_bonus);

  } catch (err) {
    outEuro.textContent  = 'Сеть недоступна или сервер не отвечает.';
    outSorry.textContent = '';
    btnCopy  && btnCopy.classList.add('hidden');
    btnAccrue && btnAccrue.classList.add('hidden');
  } finally {
    if (btnCheck) {
      btnCheck.disabled = false;
      btnCheck.textContent = oldBtnText ?? 'Проверить';
    }
  }
}

// клик по "Проверить"
btnCheck?.addEventListener('click', sendRequest);

// Enter в input
inputID?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendRequest();
});

// Копирование евробонуса
btnCopy?.addEventListener('click', async () => {
  const euroText   = outEuro?.innerText ?? '';
  const textToCopy = makeCopyTextFromEuro(euroText);

  try {
    await navigator.clipboard.writeText(textToCopy);
    btnCopy.textContent = 'Скопировано';
    setTimeout(() => (btnCopy.textContent = 'Скопировать'), 1200);
  } catch {
    btnCopy.textContent = 'Нет доступа к буферу';
    setTimeout(() => (btnCopy.textContent = 'Скопировать'), 1200);
  }
});

// === 1) Маппинг ответов API -> текст алерта ===
const FREEBET_ERROR_MAP = Object.freeze({
  'email is not in the correct format': 'Некорректный формат почты',
  'clientId is empty': 'Отсутствует номер счета',
  'clientId letters and symbols are not allowed': 'Некорректный номер счета',
  'email is empty': 'Отсутствует почта пользователя',
});

function translateFreebetResponse(payload, httpOk = true, httpStatus = 200, rawText = '') {
  if (payload && payload.result === 'success') return 'Запрос на бонус отправлен';
  if (payload && typeof payload.errorText === 'string') {
    return FREEBET_ERROR_MAP[payload.errorText] || payload.errorText;
  }
  if (!httpOk) return `Ошибка: HTTP ${httpStatus}`;
  return rawText || 'Неожиданный ответ сервера';
}

// === 2) Небольшая локальная валидация, чтобы зря не дергать API ===
function validateClientIdEmail(clientId, email) {
  if (!clientId) return FREEBET_ERROR_MAP['clientId is empty'];
  if (!/^\d+$/.test(clientId)) return FREEBET_ERROR_MAP['clientId letters and symbols are not allowed'];
  if (!email) return FREEBET_ERROR_MAP['email is empty'];
  // достаточно базовой проверки
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return FREEBET_ERROR_MAP['email is not in the correct format'];
  return null; // всё ок
}

// === 3) Обработчик клика по "Начислить" ===
// Подставь актуальные способы получить clientId и email в твоем проекте:
function getClientId() {
  // если у тебя input с номером счета называется иначе — поменяй селектор
  return document.getElementById('inputID')?.value?.trim() || '';
}
function getUserEmail() {
  // подстрой под свою логику: глобальный объект, скрытый input, и т.п.
  return (window.CURRENT_USER?.email
       || document.getElementById('user-email')?.textContent
       || document.querySelector('input[name="email"]')?.value
       || '').trim();
}

document.getElementById('vip-tablo-accrue')?.addEventListener('click', async () => {
  try {
    const clientId = getClientId();
    const email = getUserEmail();

    // мгновенный фидбек, если данные некорректны
    const validationMsg = validateClientIdEmail(clientId, email);
    if (validationMsg) {
      showNotice('Ошибка', validationMsg, 'error');
      return;
    }

    const res = await fetch('/api/v1/acquire_freebet', {
      method: 'POST',
      credentials: 'include', 
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ clientId, email }),
    });

    let payload = null, raw = '';
    try { payload = await res.json(); } catch { raw = await res.text(); }

    const msg = translateFreebetResponse(payload, res.ok, res.status, raw);
    // успех только когда API вернул {"result":"success"}
    const isSuccess = Boolean(payload && payload.result === 'success');

    showNotice(isSuccess ? 'Готово' : 'Ошибка', msg, isSuccess ? 'success' : 'error');
  } catch (err) {
    console.error(err);
    showNotice('Сеть недоступна', 'Не удалось отправить запрос. Проверьте соединение и попробуйте ещё раз.', 'error');
  }
});


function showNotice(title, text, type='info') {
  Swal.fire({
    title, text,
    icon: type, confirmButtonText: 'Ок'
  });
}
// === 4) Тесты маппинга ===
window.demoFreebetSuccess = () =>
  showNotice('Готово', 'Запрос на бонус отправлен', 'success');

window.demoFreebetError = () =>
  showNotice('Ошибка', 'Некорректный формат почты', 'error');

// Можно ещё глянуть любой текст ошибки:
window.demoFreebetCustomError = (txt = 'rate limit exceeded') =>
  showNotice('Ошибка', String(txt), 'error');
