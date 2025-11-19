// ---------- DOM ----------
const inputID = document.querySelector('.wager-window-id-client-input input');
const btnTABLO     = document.querySelector('.button-wager');
const out     = document.querySelector('.tablo-info-body-response');
const copyBtn = document.querySelector('.tablo-info-body-button-copy');
const answersWrap = document.querySelector('.buttons-answers-for-clients');
const btnAnsLeft  = document.querySelector('.answer-left');
const btnAnsRight = document.querySelector('.answer-right');
const bonusRateEl = document.querySelector('.bonusrate');
if (copyBtn) copyBtn.classList.add('hidden');

let macroIndex = 0;

const SORRY_MACROS = [
  // 1
  `<div class="macro">
    пока вам доступны только стандартные предложения:<br>
    ⭐ Общие акции находятся здесь: https://pari.ru/bonuses<br>
    ⭐ Индивидуальные предложения всегда поступают в SMS, на электронную почту или PUSH-уведомлением;<br>
    ⭐ Также конкурсы проводятся в нашем сообществе ВК: https://vk.com/bc_pari или на сайтах партнеров.
  </div>`,

  // 2
  `<div class="macro">
    сейчас для вас нет предложений 😔<br>
    Акции зачисляются в индивидуальном порядке, если для вас появится какое-то индивидуальное предложение, то вы обязательно получите письмо на почту, смс сообщение или push-уведомление. 📧
  </div>`,

  // 3 (если пришла причина из back)
  `<div class="macro">
    сейчас для вас нет индивидуальных предложений. Вы обязательно узнаете о доступных бонусах и акциях из SMS, электронной почты или PUSH-уведомлений.<br>
    Мы сообщим вам о бонусе при первой же возможности 🍀<br>
    Информация о действующих акциях:<br>
    ⭐️ Актуальные акции: <a href="https://pari.ru/bonuses" target="_blank" rel="noopener">https://pari.ru/bonuses</a><br>
    ⭐️ В сообществе ВК, где мы регулярно проводим конкурсы: <a href="https://i.pari.ru/pvk" target="_blank" rel="noopener">https://i.pari.ru/pvk</a> или на сайтах партнеров.
  </div>`,

  // 4 (про активность)
  `<div class="macro">
    сейчас индивидуальные предложения по вашему игровому счету отсутствуют. Мы начисляем бонусы не по графику, и они зависят от совокупности факторов.<br>
    Вы обязательно узнаете о доступных бонусах и акциях из SMS, электронной почты или PUSH-уведомлений.<br>
    Продолжайте активную игру и мы сообщим вам о бонусе при первой же возможности 😊
  </div>`,

  // 5 (про партнёров/ивенты)
  `<div class="macro">
    акционные предложения еще не успели сформироваться. Активно заключайте пари в течение двух недель, чтобы повысить свои шансы получить бонус/фрибет. Кстати, его размер зависит от оборота ставок! 🤑<br>
    Все просто: играйте и следите за нашими уведомлениями, чтобы ничего не пропустить!
  </div>`,
];

let lastApiResponse = null;

const text_mail_1 = `
На вашем счете не подтвержден электронный адрес. Можете запросить код активации или сменить на актуальный в приложении, либо по ссылке 👉 pari.ru/account/profile/change-email/`;
const text_mail_2 = `
На вашем счете отсутствует адрес электронной почты❕ Внести адрес электронной почты можете во вкладке «Профиль» (нажмите на силуэт человека в верхнем правом углу) или по ссылке: 🔗 https://pari.ru/account/profile/change-email 🙌`;

function ensureMacroHost() {
  // создаём контейнер под слайды, если его ещё нет
  let host = out.querySelector('#macros-slide-denial');
  if (!host) {
    host = document.createElement('div');
    host.id = 'macros-slide-denial';
    host.className = 'macros-slide-denial';
    out.appendChild(host);
  }
  return host;
}

function resetUIBeforeFetch() {
  // спрятать стрелки
  showAnswerButtons(false);

  // спрятать кнопку "Скопировать"
  if (copyBtn) copyBtn.classList.add('hidden');
  if (bonusRateEl) bonusRateEl.textContent = '';

  // убрать текущий слайд карусели (если был)
  const host = out.querySelector('#macro-slide');
  if (host) host.remove();
}


function renderMacro(index = macroIndex) {
  const host = ensureMacroHost();
  macroIndex = (index + SORRY_MACROS.length) % SORRY_MACROS.length;

  // Берём HTML текущего макроса
  let macroHtml = SORRY_MACROS[macroIndex];

  // По умолчанию доп. блок про почту пустой
  let mailPartHtml = '';

  if (lastApiResponse) {
    const name = lastApiResponse.client_first_name;
    const isEmailProvided  = !!lastApiResponse.is_email_provided;  // true/false
    const isEmailConfirmed = !!lastApiResponse.is_email_confimed;  // ОБРАТИ ВНИМАНИЕ: confimed как в JSON

    // 1) Имя: "Имя, " перед текстом макроса
    if (name) {
      // Вставляем "Имя, " сразу после <div class="macro">
      macroHtml = macroHtml.replace(
        '<div class="macro">',
        `<div class="macro">${escapeHtml(name)}, `
      );
    }

    // 2) Логика по почте:
    //
    // if (is_email_provided == true && is_email_confimed == true) — ничего не добавляем
    // elif (is_email_provided == true && is_email_confimed == false) — + text_mail_1
    // elif (is_email_provided == false && is_email_confimed == false) — + text_mail_2

    if (isEmailProvided && !isEmailConfirmed) {
      // почта указана, но не подтверждена
      if (typeof text_mail_1 !== 'undefined') {
        mailPartHtml = `<br><br>${escapeHtml(text_mail_1)}`;
      }
    } else if (!isEmailProvided && !isEmailConfirmed) {
      // почта не указана и не подтверждена
      if (typeof text_mail_2 !== 'undefined') {
        mailPartHtml = `<br><br>${escapeHtml(text_mail_2)}`;
      }
    }
  }

  // Итого в div макроса будет:
  // "Имя, SORRY_MACROS[macroIndex] \n\n text_mail_X"
  host.innerHTML = `${macroHtml}${mailPartHtml}`;
}

function showAnswerButtons(show) {
  if (!answersWrap) return;
  answersWrap.classList.toggle('hidden', !show);
}

function setupAnswerButtons() {
  if (!btnAnsLeft || !btnAnsRight) return;
  btnAnsLeft.onclick  = () => renderMacro(macroIndex - 1);
  btnAnsRight.onclick = () => renderMacro(macroIndex + 1);
}

function normalizeError(details) {
  if (!details) return 'Неизвестная ошибка';
  if (typeof details === 'string') return details;

  const msg = details.message || details.detail || details.error || JSON.stringify(details);

  // Для частого случая 500/KeyError дадим более понятное сообщение
  if (/HTTP\s*500/i.test(msg) || /KeyError/i.test(msg)) {
    return 'Сервис Евробонус временно недоступен или вернул некорректные данные. Попробуйте позже.';
  }
  return String(msg);
}

// ---------- helpers ----------
const escapeHtml = s => String(s ?? '')
  .replaceAll('&','&amp;').replaceAll('<','&lt;')
  .replaceAll('>','&gt;').replaceAll('"','&quot;')
  .replaceAll("'", '&#39;');

const fmt = n => (n === null || n === undefined || isNaN(Number(n)))
  ? '—'
  : Number(n).toLocaleString('ru-RU');

const API_PATH = '/api/v1/sorry_bonus'; // если у тебя другой путь — просто поправь эту строку

function render(data) {
  if (!data) return '<div>Пустой ответ</div>';

  let html = '';
  // ПРОВЕРКА, ЕСЛИ ВИП, ТО ВЫВОДИМ И СОРРИ И ЕВРО
  if (data.client_type && data.client_type == 'vip') {
    html += `<span class="client-vip">🚨 Клиент - ${escapeHtml((data.client_type).toUpperCase())} 🚨</span><br><br><div class="atention-vip-response-parts">`;
    if (data.euro_bonus) {
    const eb = data.euro_bonus;
    html += `<div class="atention-vip-response-part1">
                <b>Евро-бонус</b><br>`;
    if (eb.data === 'error') {
        html += `Ошибка: ${escapeHtml(normalizeError(data?.euro_bonus?.details))}`;
    } else {
        if (typeof eb.has_offer === 'boolean') {
            html += `Доступен: ${eb.has_offer ? '✅' : '❌'}<br>`;
        }
        if (eb.euro_bonus_answer) {
            html += `${escapeHtml(eb.euro_bonus_answer)}<br></div>`;
        }
    }
    html += `<br>`;
    }
      // --- Sorry-bonus ---
    if (data.sorry_bonus) {
        const sb = data.sorry_bonus;
        html += `<div class="atention-vip-response-part2"><b>Сорри-бонус</b><br>`;
        if (sb.data === 'error') {
        html += `Ошибка: ${escapeHtml(normalizeError(data?.sorry_bonus?.details))}`;
        } else if (sb.data) {
        if (sb.data.have_bonus) {
            html += `Доступен: ✅<br>`;
            if (sb.data.sum_bn != null) html += `Сумма: ${fmt(sb.data.sum_bn)} ₽<br>`;
            html += `<br>`;
        } else {
            html += `Доступен: ❌<br>`;
            if (sb.data.reason)     html += `Причина: ${escapeHtml(sb.data.reason)}<br></div></div>`;
            html += `<br>`;
        }
        } else {
        html += `Данных нет<br><br>`;
        }
    }
    return html || '<div class="no-info">🚨 Запрет на участие в акциях 🚨</div>';
  }

    if (data.sorry_bonus) {
        const sb = data.sorry_bonus;
        if (sb.data === 'error') {
            html += `Ошибка: ${escapeHtml(String(sb.details || ''))}<br><br>`;
        } else if (sb.data) {
            if (sb.data.have_bonus) {
                html += `<div class="client-have-bonus">Доступен фрибет<br>${fmt(sb.data.sum_bn)} ₽</div><br>`;
                html += `<br>`;
            } else {
                html += `
                <div class="client-dont-have-bonus">
                    <div id="macros-slide-denial" class="macros-slide-denial"></div>
                </div>`;
            }
        } else {
            html += `Данных нет<br><br>`;
        }
    } 

  return html || '<div class="no-info">🚨 Запрет на участие в акциях 🚨</div>';
}

// ---------- actions ----------
async function sendRequest() {
  const id = (inputID?.value || '').trim();
  resetUIBeforeFetch();

  // фронтовая валидация под твою схему ClientIdSchema (ровно 8 цифр)
  if (!/^\d{8}$/.test(id)) {
    out.textContent = 'Номер счёта должен содержать ровно 8 цифр.';
    return;
  }

  btnTABLO.disabled = true;
  const oldText = btnTABLO.textContent;
  btnTABLO.textContent = 'Проверяю…';
  out.innerHTML  = '<div class="wait-sorry-user"><img src="/static/img/dotsv2.gif"></div>';
  if (copyBtn) copyBtn.classList.add('hidden');

  try {
    const res = await fetch(API_PATH, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      credentials: 'include', // важнo, если эндпоинт защищён сессией
      body: JSON.stringify({ client_id: id })
    });

    if (res.status === 401) {
      out.innerHTML = 'Вы не авторизованы. <a href="/auth/login/google">Войти через Google</a>';
      return;
    }

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
    lastApiResponse = data;
    if (bonusRateEl) {
      const rawBonusRate =
        data && data.client_rate != null
          ? data.client_rate
          : (data?.sorry_bonus?.data && data.sorry_bonus.data.client_rate != null
              ? data.sorry_bonus.data.client_rate
              : null);

      // если значение не пришло — просто очищаем звёздочку
      if (rawBonusRate === null || rawBonusRate === undefined || rawBonusRate === '') {
        bonusRateEl.textContent = '';
      } else {
        bonusRateEl.textContent = String(rawBonusRate);
      }
    }
    out.innerHTML = render(data);

    // логика показа карусели только если есть sorry_bonus и он НЕ доступен
    const sbData = data?.sorry_bonus?.data;
    const noSorryBonus = !!(sbData && sbData.have_bonus === false);
    const isVIP = (String(data?.client_type || '').toLowerCase() === 'vip') || (data?.is_vip === true);
    const showMacros = noSorryBonus && !isVIP;

    showAnswerButtons(showMacros);

    // --- кнопка действия: "Начислить" если есть фрибет, иначе "Скопировать"
    const hasFreebet = !!(sbData && sbData.have_bonus === true);
    if (copyBtn) {
      copyBtn.classList.remove('hidden');
      // сброс возможного старого обработчика
      copyBtn.onclick = null;

      if (hasFreebet) {
        copyBtn.textContent = 'Начислить';
        copyBtn.onclick = async () => {
          const clientId = (inputID?.value || '').trim();
          if (!clientId) { alert('Введите номер счёта'); return; }

          const prev = copyBtn.textContent;
          copyBtn.disabled = true;
          copyBtn.textContent = 'Отправляю...';

          try {
            const res = await fetch(`/api/v1/acquire_freebet`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ clientId })
            });

            let msg = '';
            try {
              const data = await res.json();
              msg = data?.result || data?.detail || JSON.stringify(data);
            } catch (_) {
              msg = await res.text();
            }
            showNotice('Готово', 'Запрос на бонус отправлен', 'success');
          } catch (e) {
            showNotice('Ошибка', 'Попробуйте еще раз', 'error');
          } finally {
            copyBtn.disabled = false;
            copyBtn.textContent = prev;
          }
        };
      } else {
        // обычный режим "Скопировать"
        copyBtn.textContent = 'Скопировать';
        copyBtn.onclick = async () => {
          const macroEl = out.querySelector('#macros-slide-denial');
          const textToCopy = macroEl ? macroEl.innerText.trim() : out.innerText.trim();
          try {
            await navigator.clipboard.writeText(textToCopy);
            copyBtn.textContent = 'Скопировано';
            setTimeout(() => copyBtn.textContent = 'Скопировать', 1200);
          } catch {
            copyBtn.textContent = 'Нет доступа к буферу';
            setTimeout(() => copyBtn.textContent = 'Скопировать', 1200);
          }
        };
      }
    }


    if (showMacros) {
    // стартуем с первого слайда
    macroIndex = 0;

    // если back прислал причину — подставим более подходящий макрос (третью карточку)
    // ничего критичного, просто приятная «подстройка»
    if (sbData?.reason) macroIndex = 2;

    renderMacro(macroIndex);
    setupAnswerButtons();
    if (copyBtn) copyBtn.classList.remove('hidden');
    } else {
    // если бонус есть или данных нет — кнопки скрываем
    if (copyBtn) copyBtn.classList.toggle('hidden', false); // копировать общий ответ оставляем
    }
  } catch (err) {
    console.error(err);
    out.textContent = 'Сетевая ошибка. Проверьте подключение.';
  } finally {
    btnTABLO.disabled = false;
    btnTABLO.textContent = oldText;
  }
}


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

// ---------- listeners ----------
btnTABLO?.addEventListener('click', sendRequest);
inputID?.addEventListener('keydown', e => { if (e.key === 'Enter') sendRequest(); });

copyBtn?.addEventListener('click', async () => {
  // этот обработчик работает только когда на кнопке написано "Скопировать"
  if ((copyBtn?.textContent || '').trim() !== 'Скопировать') return;

  const macroEl = out.querySelector('#macros-slide-denial');
  const textToCopy = macroEl ? macroEl.innerText.trim() : out.innerText.trim();
  try {
    await navigator.clipboard.writeText(textToCopy);
    copyBtn.textContent = 'Скопировано';
    setTimeout(() => copyBtn.textContent = 'Скопировать', 1200);
  } catch {
    copyBtn.textContent = 'Нет доступа к буферу';
    setTimeout(() => copyBtn.textContent = 'Скопировать', 1200);
  }
});

