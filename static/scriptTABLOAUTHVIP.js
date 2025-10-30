//const API_BASE = "http://192.168.220.66:8100";
//const FRONTEND_URL = "http://192.168.220.66:8100";

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
    window.location.href = 'http://192.168.220.66:8100/';
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


// ССЫЛКА ПЕРЕХОД НА СТРАНИЦУ ПЕРСОНАЛЬНЫХ АКЦИЙ
document.getElementById('personal-actions').addEventListener('click', () => {
  window.location.href = 'http://192.168.220.66:8100/personal';
});

// ССЫЛКА ПЕРЕХОД НА СТРАНИЦУ VIP ОТЫГРЫША БОНУСА
document.getElementById('bonus-wager').addEventListener('click', () => {
  window.location.href = 'http://192.168.220.66:8100/vip_wager';
});

// ССЫЛКА ПЕРЕХОД НА СТРАНИЦУ ОБЩИХ АКЦИЙ
document.getElementById('general-actions').addEventListener('click', () => {
  window.location.href = 'http://192.168.220.66:8100/vip_home';
});

document.addEventListener('DOMContentLoaded', async () => {
  //сразу проверка если не залогинен то давай до свидания
  const me = await checkAuth({ redirectIfUnauthed: true });
  if (!me) return;

  //ну если залогинен:
  // ЭЛЕМЕНТЫ МЕНЮ ПРОФИЛЯ
  const profileBtn   = document.querySelector('.profile-button-vip');
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