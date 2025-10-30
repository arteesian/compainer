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
const $loginScreen   = document.getElementById('login-screen');
const $profileScreen = document.getElementById('profile-screen');
const $userEmail     = document.getElementById('user-email');
const $userRole      = document.getElementById('user-role');

if ($loginScreen)   $loginScreen.style.display   = 'none';
if ($profileScreen) $profileScreen.style.display = 'none';


// Проверяем, авторизован ли пользователь
async function checkAuth() {
  try {
    const res = await fetch(`/api/me`, { credentials: 'include' });
    if (!res.ok) { 
      showLogin();
      return;
    }
    const user = await res.json();
    showProfile(user);
  } catch (e) {
    console.error('checkAuth error:', e);
    showLogin();
  }
}

function showLogin() {
  if ($profileScreen) $profileScreen.style.display = 'none';
  if ($loginScreen)   $loginScreen.style.display   = 'flex'; // в CSS у тебя flex
}


function showProfile(user) {
  window.CURRENT_USER = user;
  if ($userEmail && user?.email) $userEmail.textContent = user.email;
  if ($userRole) $userRole.textContent = Array.isArray(user.roles) ? user.roles.join(", ") : (user.role ?? "");
  if ($loginScreen)   $loginScreen.style.display   = 'none';
  if ($profileScreen) $profileScreen.style.display = 'flex'; // в CSS у тебя flex
}

function showAdmin(data) {
    document.getElementById('admin-message').textContent = data.message;
    document.getElementById('profile-screen').classList.add('hidden');

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
    window.location.reload();
    showLogin();
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

// ССЫЛКА ПЕРЕХОД В КАМПЕЙНЕР
document.getElementById('button-to-campeiner').addEventListener('click', () => {
  const role = window.CURRENT_USER;
  if (hasRole(role, "vip")) {
      window.location.href = '/vip_home';
    } else {
      window.location.href = '/home';
    }
});

// Запуск при загрузке
checkAuth();