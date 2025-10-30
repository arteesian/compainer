const API_BASE = "http://0.0.0.0:8100";
const FRONTEND_URL = "http://0.0.0.0:8100";

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
async function checkAuth() {
    try {
    const res = await fetch(`${API_BASE}/api/me`, {
        credentials: 'include' // ← отправляем cookie!
    });
    if (res.ok) {
        const user = await res.json();
        console.log(user)
        showProfile(user);
    } else {
        showLogin();
    }
    } catch (e) {
    showLogin();
    }
}

function showLogin() {
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('profile-screen').classList.add('hidden');
    document.getElementById('admin-screen').classList.add('hidden');

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('error')) {
    document.getElementById('error').textContent = 'Ошибка входа';
    document.getElementById('error').classList.remove('hidden');
    }
}

function showProfile(user) {
    document.getElementById('user-email').textContent = user.email;
    const roleEl = document.getElementById('user-role');
    roleEl.textContent = Array.isArray(user.roles) ? user.roles.join(", ") : (user.role || "");
    roleEl.className = getRoles(user).map(r=>`role-${r}`).join(" ");

    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('profile-screen').classList.remove('hidden');
    document.getElementById('admin-screen').classList.add('hidden');

    // Показываем кнопку админки, если админ
    document.getElementById('admin-btn').classList.toggle('hidden', !hasRole(user,'admin'));
}

function showAdmin(data) {
    document.getElementById('admin-message').textContent = data.message;
    document.getElementById('profile-screen').classList.add('hidden');
    document.getElementById('admin-screen').classList.remove('hidden');
}

// Действия
function login() {
    window.location.href = `${API_BASE}/auth/login/google`;
}

async function logout() {
    await fetch(`${API_BASE}/auth/logout`, {
    method: 'POST',
    credentials: 'include'
    });
    window.location.reload();
}

async function openAdmin() {
    try {
    const res = await fetch(`${API_BASE}/api/admin`, {
        credentials: 'include'
    });
    if (res.ok) {
        const data = await res.json();
        showAdmin(data);
    } else if (res.status === 403) {
        alert('Нет доступа к админке');
    } else if (res.status === 401) {
        window.location.reload(); // сессия протухла
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
  window.location.href = 'http://0.0.0.0:8100/personal';
});

// ССЫЛКА ПЕРЕХОД НА СТРАНИЦУ ОБЩИХ АКЦИЙ
document.getElementById('general-actions').addEventListener('click', () => {
  window.location.href = 'http://0.0.0.0:8100/home';
});

// ССЫЛКА ПЕРЕХОД НА СТРАНИЦУ ОТЫГРЫША БОНУСА
document.getElementById('bonus-wager').addEventListener('click', () => {
  window.location.href = 'http://0.0.0.0:8100/wager';
});

// ССЫЛКА ПЕРЕХОД НА СТРАНИЦУ ОТЫГРЫША БОНУСА
document.getElementById('bonus-wager').addEventListener('click', () => {
  window.location.href = 'http://0.0.0.0:8100/tablo';
});

// Запуск при загрузке
checkAuth();