
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
//const API_BASE = "";

const $ = (sel) => document.querySelector(sel);
const tbody = $("#sa-users-tbody");
const toast = $("#sa-toast");
const roleFilter = $("#sa-role-filter");
const searchInput = $("#sa-search");

document.getElementById('general-actions').addEventListener('click', () => location.href = '/home');
document.getElementById('personal-actions').addEventListener('click', () => location.href = '/personal');
document.getElementById('bonus-wager').addEventListener('click', () => location.href = '/wager');
document.getElementById('tablo').addEventListener('click', () => location.href = '/tablo');

let currentUser = null;    // кто залогинен (для запрета самоснятия админки)
let rawUsers = [];         // полный список с сервера
let viewUsers = [];        // после клиентского поиска

function showToast(msg, ok = true) {
  toast.textContent = msg;
  toast.classList.remove("hidden", "save-correct", "save-failed");

  if (ok) {
    toast.classList.add("save-correct");
  } else {
    toast.classList.add("save-failed");
  }

  toast.style.color = "";

  setTimeout(() => {
    toast.classList.add("hidden");
    toast.classList.remove("save-correct", "save-failed");
  }, 1800);
}

async function ensureSuperadmin() {
  const r = await fetch(`/api/me`, { credentials: "include" });
  if (!r.ok) { location.href = "/home"; return false; }
  currentUser = await r.json();
  if (!Array.isArray(currentUser.role) 
    ? currentUser.role !== "superadmin"
    : !currentUser.role.includes("superadmin")) {
  location.href = "/home";
  return false;
}
  return true;
}

function roleFromFlags(u) {
  if (u.is_admin) return "admin";
  if (u.is_vip) return "vip";
  return "user";
}

function render() {
  const q = (searchInput.value || "").trim().toLowerCase();
  const list = rawUsers.filter(u => !q || u.email.toLowerCase().includes(q));
  viewUsers = list;
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="padding:12px;">Ничего не найдено</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(u => {
    const role = roleFromFlags(u);
    const self = currentUser && currentUser.email === u.email;
    // если это я — запрещаем снять у себя admin (и вообще править себя)
    const vipBox = `<input type="checkbox" class="sa-vip" data-email="${u.email}" ${u.is_vip ? "checked" : ""} ${self ? "disabled" : ""}>`;
    const admBox = `<input type="checkbox" class="sa-admin" data-email="${u.email}" ${u.is_admin ? "checked" : ""} ${self ? "disabled" : ""}>`;
    const actBtn = `<button class="sa-refresh" data-email="${u.email}">↻</button>`;
    return `
      <tr>
        <td style="padding:10px;">${u.email}</td>
        <td style="padding:10px;"><span class="badge role-${role}">${role.toUpperCase()}</span></td>
        <td style="padding:10px;">${vipBox}</td>
        <td style="padding:10px;">${admBox}</td>
        <td style="padding:10px;display:flex;gap:8px;">${actBtn}</td>
      </tr>`;
  }).join("");
}

async function fetchUsers() {
  const params = new URLSearchParams();
  const rf = roleFilter.value;
  if (rf) params.set("role", rf);
  tbody.innerHTML = `<tr><td colspan="5" style="padding:12px;">Загрузка…</td></tr>`;
  const r = await fetch(`/api/v1/superadmin/users/?${params.toString()}`, { credentials: "include" });
  if (!r.ok) {
    tbody.innerHTML = `<tr><td colspan="5" style="padding:12px;color:crimson;">Ошибка загрузки (${r.status})</td></tr>`;
    return;
  }
  rawUsers = await r.json(); // [{email,is_vip,is_admin}]
  render();
}

async function patchRole(email, nextVIP, nextADM) {
  const body = { email };
  if (typeof nextVIP === "boolean") body.is_vip = nextVIP;
  if (typeof nextADM === "boolean") body.is_admin = nextADM;

  const r = await fetch(`/api/v1/superadmin/users/role`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body)
  });

  if (!r.ok) {
    showToast(`🚨 Ошибка (${r.status})`, false);
    // вернуть UI в исходное
    await fetchUsers();
    return false;
  }
  showToast("✅ Сохранено");
  return true;
}

document.addEventListener("change", async (e) => {
  const t = e.target;
  if (t.classList.contains("sa-vip") || t.classList.contains("sa-admin")) {
    const email = t.getAttribute("data-email");
    // актуальные значения для обеих галок
    const row = viewUsers.find(u => u.email === email) || rawUsers.find(u => u.email === email);
    const nextVIP = (t.classList.contains("sa-vip")) ? t.checked : row.is_vip;
    const nextADM = (t.classList.contains("sa-admin")) ? t.checked : row.is_admin;

    // запрет на самоснятие/редактирование себя
    if (currentUser && currentUser.email === email) {
      showToast("Нельзя править свою запись", false);
      await fetchUsers();
      return;
    }

    const ok = await patchRole(email, nextVIP, nextADM);
    if (ok) {
      // локально обновим для мгновенного UI
      const target = rawUsers.find(u => u.email === email);
      if (target) { target.is_vip = nextVIP; target.is_admin = nextADM; }
      render();
    }
  }
});

document.addEventListener("click", async (e) => {
  const t = e.target;
  if (t.classList.contains("sa-refresh")) {
    await fetchUsers();
  }
});

roleFilter.addEventListener("change", fetchUsers);
searchInput.addEventListener("input", render);

(async function init() {
  const ok = await ensureSuperadmin();
  if (!ok) return;
  await fetchUsers();
})();

////////////////////////////////////////////////////////////////////////////////////
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
      console.log(user)
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


// ССЫЛКА ПЕРЕХОД НА СТРАНИЦУ ПЕРСОНАЛЬНЫХ АКЦИЙ
document.getElementById('personal-actions').addEventListener('click', () => {
  window.location.href = '/personal';
});


// ССЫЛКА ПЕРЕХОД НА СТРАНИЦУ ОТЫГРЫША БОНУСА
document.getElementById('bonus-wager').addEventListener('click', () => {
  const role = window.CURRENT_USER;
  if (hasRole(role, "vip")) {
        window.location.href = '/vip_wager';
    } else {
      window.location.href = '/wager';
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

// ССЫЛКА ПЕРЕХОД НА СТРАНИЦУ tablo
document.getElementById('tablo').addEventListener('click', () => {
  const role = window.CURRENT_USER;
  if (hasRole(role, "vip")) {
        window.location.href = '/vip_tablo';
    } else {
      window.location.href = '/tablo';
    }
});

document.addEventListener('DOMContentLoaded', async () => {
  //сразу проверка если не залогинен то давай до свидания
  const me = await checkAuth({ redirectIfUnauthed: true });
  if (!me) return;

  //ну если залогинен:
  // ЭЛЕМЕНТЫ МЕНЮ ПРОФИЛЯ
  const profileBtn   = document.querySelector('.profile-button-super-admin');
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