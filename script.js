const API_BASE = "http://127.0.0.1:8100";
const FRONTEND_URL = "http://127.0.0.1:5500";

// Проверяем, авторизован ли пользователь
async function checkAuth() {
    try {
    const res = await fetch(`${API_BASE}/api/me`, {
        credentials: 'include' // ← отправляем cookie!
    });
    if (res.ok) {
        const user = await res.json();
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
    roleEl.textContent = user.role;
    roleEl.className = `role-${user.role}`;

    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('profile-screen').classList.remove('hidden');
    document.getElementById('admin-screen').classList.add('hidden');

    // Показываем кнопку админки, если админ
    document.getElementById('admin-btn').classList.toggle('hidden', user.role !== 'admin');
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

function backToProfile() {
    checkAuth(); // просто обновим профиль
}

// Запуск при загрузке
checkAuth();