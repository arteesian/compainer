//const API_BASE = "";
//const FRONTEND_URL = "";

// --- Roles helpers (single or multiple) ---
function getRoles(u) {
  const r = (u && (u.roles ?? u.role)) ?? null;
  if (Array.isArray(r)) return r.map(x => String(x).toLowerCase());
  if (r != null) return [String(r).toLowerCase()];
  return [];
}
function hasRole(u, role) {
  return getRoles(u).includes(String(role).toLowerCase());
}

// Проверяем, авторизован ли пользователь
async function checkAuth({ redirectIfUnauthed = true } = {}) {
  try {
    const res = await fetch(`/api/me`, { credentials: 'include' });
    if (res.ok) {
      const user = await res.json();
      window.CURRENT_USER = user; // сохраним для последующего кода
      applyProfileInitials({ role: user?.role, roles: user?.roles, email: user?.email });
      return user;
    } else {
      if (redirectIfUnauthed) window.location.replace(`/`);
      return null;
    }
  } catch (e) {
    console.log(e);
    if (redirectIfUnauthed) window.location.replace(`/`);
    return null;
  }
}

// === ИНИЦИАЛЫ ИЗ ПОЧТЫ + ВСТАВКА В ИКОНКУ ПРОФИЛЯ ===
function emailToInitials(email) {
  if (!email || typeof email !== 'string') return '';
  const local = (email.split('@')[0] || '').trim();
  if (!local) return '';

  let a = '', b = '';
  if (local.includes('.')) {
    const [left, right] = local.split('.', 2);
    a = (left || '').trim()[0] || '';
    b = (right || '').trim()[0] || '';
  } else {
    a = local[0] || '';
    b = local[1] || '';
  }
  return (a + b).toUpperCase();
}

function applyProfileInitials({ role, roles, email } = {}) {
  const initials = emailToInitials(email);
  const rolesNorm = Array.isArray(roles) ? roles.map(x => String(x).toLowerCase()) : (role ? [String(role).toLowerCase()] : []);
  const roleNorm = rolesNorm[0] || "";
  const vipEl = document.querySelector('span.profile-icon-vip');
  const regEl = document.querySelector('span.profile-icon');

  // Очистим оба на всякий случай
  if (vipEl) vipEl.textContent = '';
  if (regEl) regEl.textContent = '';

  if (!initials) return;

  if ((rolesNorm.includes('vip')) && vipEl) {
    vipEl.textContent = initials;
  } else if (regEl) {
    regEl.textContent = initials;
  } else if (vipEl) {
    vipEl.textContent = initials;
  }
}


function showAdmin(data) {
    document.getElementById('admin-message').textContent = data.message;
    document.getElementById('profile-screen').classList.add('hidden');
    document.getElementById('admin-screen').classList.remove('hidden');
}

// Действия
function login() {
    window.location.href = `/auth/login/google`;
}

async function logout() {
    await fetch(`/auth/logout`, {
    method: 'POST',
    credentials: 'include'
    });
    window.location.href = '/';
}

async function openAdmin() {
    try {
    const res = await fetch(`/api/admin`, {
        credentials: 'include'
    });
    if (res.ok) {
        const data = await res.json();
        showAdmin(data);
    } else if (res.status === 403) {
        alert('Нет доступа к админке');
    } else if (res.status === 401) {
        //window.location.reload(); // сессия протухла
        window.location.replace(`/`);
    }
    } catch (e) {
    console.error(e);
    alert('Ошибка');
    }
}

  (function () {
    const btnSUPAD = document.getElementById('btn-superadmin');
    if (!btnSUPAD) return;
    const role = window.CURRENT_USER;
    //console.log(window.CURRENT_USER.role)
    if (hasRole(role, "superadmin")) {
      btnSUPAD.classList.remove('hidden');
      btnSUPAD.addEventListener('click', () => {
        window.location.href = '/superadmin.html';
      });
    }
  })();

function backToProfile() {
    checkAuth(); // просто обновим профиль
}

// ССЫЛКА ПЕРЕХОД НА СТРАНИЦУ ОТЫГРЫША БОНУСА
document.getElementById('bonus-wager').addEventListener('click', () => {
  const role = window.CURRENT_USER;
  if (hasRole(role, "vip")) {
        window.location.href = '/vip_wager';
    } else {
      window.location.href = '/wager';
    }
});

// ССЫЛКА ПЕРЕХОД НА СТРАНИЦУ ТАБЛО
document.getElementById('tablo').addEventListener('click', () => {
  const role = window.CURRENT_USER;
  if (hasRole(role, "vip")) {
        window.location.href = '/vip_tablo';
    } else {
      window.location.href = '/tablo';
    }
});


// ССЫЛКА ПЕРЕХОД НА СТРАНИЦУ ОБЩИХ АКЦИЙ
document.getElementById('general-actions').addEventListener('click', () => {
  const role = window.CURRENT_USER;
  if (hasRole(role, "vip")) {
        window.location.href = '/vip_home';
    } else {
      window.location.href = '/home';
    }
});

document.getElementById('general-actions').addEventListener('click', () => {
  window.location.href = '/home';
});

document.addEventListener('DOMContentLoaded', async () => {
  //сразу проверка если не залогинен то давай до свидания
  const me = await checkAuth({ redirectIfUnauthed: true });
  if (!me) return;

  //ну если залогинен:
  // ЭЛЕМЕНТЫ МЕНЮ ПРОФИЛЯ
  const profileBtn   = document.querySelector('.profile-button');
  const profileMenu  = document.getElementById('profile-menu');
  const adminItem    = document.getElementById('profile-admin');
  const logoutItem   = document.getElementById('profile-logout');

  // ХЭЛПЕР: безопасно закрыть меню
  const closeMenu = () => { if (profileMenu && !profileMenu.classList.contains('hidden')) profileMenu.classList.add('hidden'); };

  // ОТКРЫТИЕ/ЗАКРЫТИЕ ПО КНОПКЕ ПРОФИЛЯ
  if (profileBtn && profileMenu) {
    profileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      profileMenu.classList.toggle('hidden');
    });

    // Клик снаружи — закрыть
    document.addEventListener('click', (e) => {
      if (!profileMenu.contains(e.target) && e.target !== profileBtn) {
        closeMenu();
      }
    });

    // Esc — закрыть
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeMenu();
    });
  }

  // ДЕЙСТВИЯ ПУНКТОВ МЕНЮ
  if (logoutItem) {
    logoutItem.addEventListener('click', async () => {
      try {
        await logout(); // уже есть в файле
      } catch (_) {
        // fallback: перезагрузка
        window.location.reload();
      }
    });
  }

  if (adminItem) {
    adminItem.addEventListener('click', () => {
      // переходим на страницу администрирования
      window.location.href = '/admin_home';
    });
  }

  // ПОЛУЧЕНИЕ ТЕКУЩЕГО ПОЛЬЗОВАТЕЛЯ
  let rolesFromTemplate = getRoles(window.CURRENT_USER);

  try {
    const r = await fetch('/api/me', { credentials: 'include' });
    if (r.ok) {
      const me = await r.json();

      // Кнопка SUPER-ADMIN (как было)
      if (me && hasRole(me, "superadmin")) {
        const btn = document.getElementById('btn-superadmin');
        if (btn) {
          btn.classList.remove('hidden');
          btn.addEventListener('click', () => location.href = '/superadmin');
        }
      }

      // Роль для меню профиля
      rolesFromTemplate = rolesFromTemplate && rolesFromTemplate.length ? rolesFromTemplate : getRoles(me);
    }
  } catch (_) {
    // если /api/me не ответил — остаёмся на roleFromTemplate из шаблона
  }

  // ПОКАЗ «Администрирование», если роль именно admin
  if (adminItem) {
    if (rolesFromTemplate.includes('admin')) {
      adminItem.classList.remove('hidden');
    } else {
      adminItem.classList.add('hidden');
    }
  }
});

// === PERSONAL ACTIONS (personal.html) ===
document.addEventListener('DOMContentLoaded', () => {
  const tableEl       = document.querySelector('.general-actions-table');
  const topbarCountEl = document.querySelector('.general-actions-top-bar-right-side');
  const arrowLeftEl   = document.querySelector('.pagination-arrow-left');
  const arrowRightEl  = document.querySelector('.pagination-arrow-right');
  const pageListEl    = document.querySelector('.quantity-of-pages-roll');
  const searchForm    = document.querySelector('.personal-searchbar');
  const searchInput   = document.querySelector('#q');

  // если мы не на personal.html — тихо выходим
  if (!tableEl || !searchForm || !searchInput) return;

  // ===== state =====
  const state = {
    clientId: '',
    offset: 0,
    limit: getPageSize(),
    total: 0,          // всего акций по клиенту
    lastPageCount: 0,  // сколько акций в последнем ответе
  };

  // ===== helpers =====
  function getPageSize() {
    // пробуем взять число из выбранного li, иначе 10
    const li = document.querySelector('.quantity-of-pages-roll li.amount-of-pages-selected')
           || document.querySelector('.quantity-of-pages-roll li');
    const val = parseInt(li?.textContent?.trim() || '10', 10);
    return Number.isFinite(val) && val > 0 ? val : 10;
  }

  function escapeHtml(str = '') {
    return String(str)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function fmtDate(d) {
    const dd   = String(d.getDate()).padStart(2, '0');
    const mm   = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh   = String(d.getHours()).padStart(2, '0');
    const min  = String(d.getMinutes()).padStart(2, '0');

    return `${dd}.${mm}.${yyyy} ${hh}:${min}`;
  }

  function fmtRange(startIso, endIso) {
    const s = startIso ? new Date(startIso) : null;
    const e = endIso   ? new Date(endIso)   : null;
    const left  = s ? fmtDate(s) : '—';
    const right = e ? fmtDate(e) : '—';
    return `${left} - ${right}`;
  }

  function statusTextFromApi(s) {
    switch ((s || '').toLowerCase()) {
      case 'available': return '• Доступна';
      case 'active':    return '• Активна';
      case 'finished':  return '• Завершена';
      default:          return '• —';
    }
  }

  function formatTurnover(value) {
    if (value == null) return '—';
    // немного человеческий формат
    try {
      return Number(value).toLocaleString('ru-RU', {
        maximumFractionDigits: 2
      });
    } catch {
      return String(value);
    }
  }

  // ===== modal для "Ответ клиенту" =====

  // ===== modal для "Ответ клиенту" и сообщений =====
  function ensureModal() {
    let wrap = document.querySelector('.ga-modal-overlay');
    if (wrap) return wrap;

    wrap = document.createElement('div');
    wrap.className = 'ga-modal-overlay hidden';
    wrap.innerHTML = `
        <div class="ga-modal">
          <button class="ga-modal-close" title="Закрыть">×</button>
          <div class="ga-modal-content"></div>
          <div class="ga-modal-copy-block">
            <button type="button" class="ga-modal-ok hidden">Ок</button>
            <button type="button" class="ga-modal-copy hidden">Скопировать</button>
          </div>
        </div>
      `;
    document.body.appendChild(wrap);

    // закрытие по клику снаружи или по крестику
    wrap.addEventListener('click', (e) => {
      if (
        e.target.classList.contains('ga-modal-overlay') ||
        e.target.classList.contains('ga-modal-close')
      ) {
        closeModal();
      }
    });

    const okBtn   = wrap.querySelector('.ga-modal-ok');
    const copyBtn = wrap.querySelector('.ga-modal-copy');

    if (okBtn) {
      okBtn.addEventListener('click', () => {
        closeModal();
      });
    }

    copyBtn.addEventListener('click', async () => {
      const contentEl = wrap.querySelector('.ga-modal-content');
      const text = contentEl?.innerText || '';
      if (!text) return;

      try {
        await navigator.clipboard.writeText(text);
        const old = copyBtn.textContent;
        copyBtn.textContent = 'Скопировано!';
        setTimeout(() => (copyBtn.textContent = old), 900);
      } catch {
        alert('Не удалось скопировать :(');
      }
    });

    return wrap;
  }


  function openAnswerModal(text) {
    const wrap = ensureModal();
    const contentEl = wrap.querySelector('.ga-modal-content');
    const copyBtn   = wrap.querySelector('.ga-modal-copy');
    const okBtn     = wrap.querySelector('.ga-modal-ok');

    contentEl.textContent = text || 'Нет текста для ответа';

    // для ответов показываем "Скопировать" и прячем "Ок"
    if (copyBtn) copyBtn.classList.toggle('hidden', !text);
    if (okBtn)   okBtn.classList.add('hidden');

    wrap.classList.remove('hidden');
    document.body.classList.add('ga-modal-lock');
  }

  function openInfoModal(text) {
    const wrap = ensureModal();
    const contentEl = wrap.querySelector('.ga-modal-content');
    const copyBtn   = wrap.querySelector('.ga-modal-copy');
    const okBtn     = wrap.querySelector('.ga-modal-ok');

    if ((text == 'Клиент относится к VIP-сегменту. Просмотр его персональных акций недоступен для вашей роли.') ||  text == 'Клиент имеет ограничения, бонусы недоступны') {
      contentEl.innerHTML = `<div class="personal-error-msg">${text}</div>`
    } else {
      contentEl.textContent = text || 'Ошибка';
    }
    

    // для инфо-сообщений прячем "Скопировать" и показываем "Ок"
    if (copyBtn) copyBtn.classList.add('hidden');
    if (okBtn)   okBtn.classList.remove('hidden');

    wrap.classList.remove('hidden');
    document.body.classList.add('ga-modal-lock');
  }


  function closeModal() {
    const wrap = document.querySelector('.ga-modal-overlay');
    if (!wrap) return;
    wrap.classList.add('hidden');
    document.body.classList.remove('ga-modal-lock');
  }

  // ===== отрисовка строки =====
  function buildRow(a) {
    const row = document.createElement('div');
    row.className = 'personal-actions-table-row';
    row.dataset.id = a.action_id;

    const rangeText  = fmtRange(a.start_time, a.finish_time);
    const statusText = statusTextFromApi(a.status);
    const answerText = a.description || '';

    const nameHtml = a.link
      ? `<a class="personal-action-link" href="${escapeHtml(a.link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(a.name ?? '')}</a>`
      : `<span class="personal-action-link">${escapeHtml(a.name ?? '')}</span>`;

    const answerButtonHtml = answerText
      ? `<button class="personal-action-answer" title="Ответ клиенту" data-answer="${escapeHtml(answerText)}">
           <img src="/static/img/macros_img.png" alt="answer">
         </button>`
      : '';

    row.innerHTML = `
      <div class="personal-actions-table-cell-name">
        ${nameHtml}
      </div>
      <div class="personal-actions-table-cell-macros">
        ${answerButtonHtml}
      </div>
      <div class="personal-actions-table-cell-time">
        ${rangeText}
      </div>
      <div class="personal-actions-table-cell-rules">
        ${formatTurnover(a.turnover_remaining)} ₽
      </div>
      <div class="personal-actions-table-cell-status">
        ${statusText == "• Активна" ? '<button class="general-action-status" id="general-action-status-active">• Активна</button>' : statusText == "• Завершена" ?  '<button class="general-action-status" id="general-action-status-ended">• Завершена</button>' : statusText == "• Доступна" ? '<button class="general-action-status" id="general-action-status-unavailable">• Доступна</button>': statusText}
      </div>
    `;

    return row;
  }

  function renderEmpty(message) {
    tableEl.innerHTML = '';
    const row = document.createElement('div');
    row.className = 'personal-actions-table-row';
    row.innerHTML = `
      <div class="personal-actions-table-cell-name" style="grid-column: 1 / -1; opacity:.7">
        ${escapeHtml(message)}
      </div>
    `;
    tableEl.appendChild(row);

    if (topbarCountEl) {
      topbarCountEl.innerHTML = `<span class="pagination-general-for-user">0-0</span> из 0`;
    }

    if (arrowLeftEl)  arrowLeftEl.disabled  = true;
    if (arrowRightEl) arrowRightEl.disabled = true;
  }

  function renderLoading() {
    tableEl.innerHTML = '';
    const row = document.createElement('div');
    row.className = 'personal-actions-table-row';
    row.innerHTML = `
      <div class="personal-actions-table-cell-name" style="grid-column: 1 / -1; opacity:.7">
        Загрузка...
      </div>
    `;
    tableEl.appendChild(row);

    // В правом верхнем углу вместо "1-10 из 14" будет просто "Загрузка..."
    if (topbarCountEl) {
      topbarCountEl.textContent = 'Загрузка...';
    }

    // На время загрузки блокируем стрелки
    if (arrowLeftEl)  arrowLeftEl.disabled  = true;
    if (arrowRightEl) arrowRightEl.disabled = true;
  }

  function render(actions) {
    tableEl.innerHTML = '';

    if (!actions.length) {
      renderEmpty('Нет акций');
      return;
    }

    actions.forEach(a => tableEl.appendChild(buildRow(a)));

    const start = state.total ? state.offset + 1 : 0;
    const end   = state.offset + actions.length;
    if (topbarCountEl) {
      topbarCountEl.innerHTML =
        `<span class="pagination-general-for-user">${start}-${end}</span> из ${state.total}`;
    }

    if (arrowLeftEl) {
      arrowLeftEl.disabled = state.offset <= 0;
    }
    if (arrowRightEl) {
      arrowRightEl.disabled = end >= state.total;
    }
  }

  // ===== загрузка данных =====
  async function loadPage() {
    if (!state.clientId) {
      renderEmpty('Введите ID клиента и нажмите Enter');
      return;
    }

    state.limit = getPageSize();

    const base = `/api/v1/personal_actions/${encodeURIComponent(state.clientId)}`;
    const url  = `${base}?offset=${state.offset}&limit=${state.limit}`;

    renderLoading();

    let res;
    try {
      res = await fetch(url, { credentials: 'include' });
    } catch (e) {
      console.error(e);
      renderEmpty('Ошибка загрузки данных');
      return;
    }

    if (res.status === 404) {
      state.total = 0;
      state.lastPageCount = 0;
      renderEmpty('Клиент не найден');
      return;
    }

    if (res.status === 400) {
      let message = 'Ошибка: бонусы недоступны';
      try {
        const errData = await res.json();
        if (errData && typeof errData.detail === 'string') {
          message = errData.detail;
        }
      } catch (e) {
        console.error('Failed to parse 400 body', e);
      }
      openInfoModal(message);
      return;
    }

    if (!res.ok) {
      console.error('Error response', res.status);
      renderEmpty('Ошибка загрузки данных');
      return;
    }

    const data = await res.json();
    const actions = Array.isArray(data.actions) ? data.actions : [];

    state.total = data.total ?? actions.length;
    state.lastPageCount = actions.length;

    render(actions);
  }

  // ===== события =====

  // поиск по client_id по Enter
  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const raw = (searchInput.value || '').trim();
    if (!raw) {
      state.clientId = '';
      renderEmpty('Введите ID клиента и нажмите Enter');
      return;
    }
    state.clientId = raw;
    state.offset = 0;
    loadPage();
  });

  // стрелка влево
  arrowLeftEl?.addEventListener('click', () => {
    if (state.offset <= 0 || !state.clientId) return;
    state.offset = Math.max(0, state.offset - state.limit);
    loadPage();
  });

  // стрелка вправо
  arrowRightEl?.addEventListener('click', () => {
    if (!state.clientId) return;
    const nextOffset = state.offset + state.limit;
    if (nextOffset >= state.total) return;
    state.offset = nextOffset;
    loadPage();
  });

  // смена количества на странице (10/30/50)
  pageListEl?.addEventListener('click', (e) => {
    const li = e.target.closest('li');
    if (!li || !state.clientId) return;
    // scriptACTIONS.js сам обновит выбранный li и кнопку,
    // а мы просто перезапросим первую страницу с новым лимитом
    state.offset = 0;
    setTimeout(loadPage, 0);
  });

  // делегирование кликов по таблице для кнопок "Ответ клиенту"
  tableEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.personal-action-answer');
    if (!btn) return;
    const text = btn.dataset.answer || '';
    openAnswerModal(text);
  });

  // стартовое состояние (без введённого client_id)
  renderEmpty('Введите ID клиента и нажмите Enter');
});
