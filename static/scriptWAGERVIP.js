
const inputID = document.querySelector('.wager-window-id-client-input input');
const btnWAGER   = document.querySelector('.button-wager-vip');
const out   = document.querySelector('.wager-info-body-response');
const copy  = document.querySelector('.wager-info-body-button-copy-vip');
if (copy) copy.classList.add('hidden');

const escapeHtml = s => String(s ?? '')
.replaceAll('&','&amp;').replaceAll('<','&lt;')
.replaceAll('>','&gt;').replaceAll('"','&quot;')
.replaceAll("'", '&#39;');

const escapeAttr = s => escapeHtml(s).replaceAll('"','&quot;');

const fmt = n => {
if (n === null || n === undefined || isNaN(Number(n))) return '—';
return Number(n).toLocaleString('ru-RU');
};

function render(data) {
if (!data) return '<div>Пустой ответ</div>';

if (!Array.isArray(data.actions) || data.actions.length === 0) {
    return '<div>Акции не найдены.</div>';
}

const items = data.actions.map(a => `
    💬 ${escapeHtml(a.action_name || 'Без названия')}<br>
    <br>
    🗓️ Начало: ${escapeHtml(a.date_start || '—')}<br>
    💸 Сумма бонуса: ${escapeHtml(a.bonus_sum || '—')} рублей<br>
    <br>
    💯 Сумма отыгрыша: ${escapeHtml(a.payback_sum || '—')} рублей<br>
    ⏳ Рассчитано ставок: ${escapeHtml(a.calculated_sum || '—')} рублей<br>
    🔒 Подтверждено ставок: ${escapeHtml(a.accepted_sum || '—')} рублей<br>
    <br>
    🗓️ Завершение: ${escapeHtml(a.date_end || '—')}<br>
    ✔️ Осталось отыграть: ${escapeHtml(a.remaining_sum || '—')} рублей<br>
    <br>
    ❗️ Статус: ${escapeHtml(a.status || '—')}<br>
    <br>
    📜️ Правила:<br>
    ${escapeHtml(a.payback_type || '—')}<br>
    <br>
    <br>
    ™️ Ссылка:<br>
    ${escapeAttr(a.url || '—')}
`).join('');

return items;
}

async function sendRequest() {
const id = (inputID.value || '').trim();
if (!/^\d{8}$/.test(id)) {
    out.innerHTML = '<span style="color:#e37;">Введите ID из 8 цифр</span>';
    inputID.focus();
    return;
}

btnWAGER.disabled = true;
const oldText = btnWAGER.textContent;
btnWAGER.textContent = 'Проверяю…';
out.innerHTML  = '<div class="wait-wager-user"><img src="/static/img/dotsv2.gif"></div>';
if (copy) copy.classList.add('hidden');

try {
    const res = await fetch('/api/v1/wager', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    credentials: 'include',     // важнo, если эндпоинт требует авторизацию по сессии
    body: JSON.stringify({ client_id: id })
    });

    // 401 — неавторизован
    if (res.status === 401) {
    out.innerHTML = 'Вы не авторизованы. <a href="/auth/login/google">Войти через Google</a>';
    return;
    }

    if (res.status === 500) {
    out.innerHTML = 'Проблемы с сервером статус 500';
    return;
    }

    if (res.status === 404) {
    out.innerHTML = '<div class="error404"><div class="error404-text">У клиента нет бонусного счета</div></div>';
    return;
    }

    // 422 — валидация (у тебя кастомный обработчик)
    if (res.status === 422) {
    const e = await res.json().catch(() => ({}));
    out.textContent = e?.details || 'Некорректный номер счёта.';
    return;
    }

    if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    const msg = e?.detail?.message || e?.detail || `Ошибка: HTTP ${res.status}`;
    out.textContent = msg;
    return;
    }

    const data = await res.json();
    out.innerHTML = render(data);
    if (copy) copy.classList.remove('hidden');
} catch (err) {
    console.error(err);
    out.textContent = 'Сетевая ошибка. Проверьте подключение.';
} finally {
    btnWAGER.disabled = false;
    btnWAGER.textContent = oldText;
}
}

btnWAGER.addEventListener('click', sendRequest);
inputID.addEventListener('keydown', e => { if (e.key === 'Enter') sendRequest(); });

if (copy) {
copy.addEventListener('click', async () => {
    try {
    await navigator.clipboard.writeText(out.innerText.trim());
    copy.textContent = 'Скопировано';
    setTimeout(() => copy.textContent = 'Скопировать', 1200);
    } catch {
    copy.textContent = 'Нет доступа к буферу';
    setTimeout(() => copy.textContent = 'Скопировать', 1200);
    }
});
}

