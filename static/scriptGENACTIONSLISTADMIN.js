// === COMMON ACTIONS LIST (home.html) ===
document.addEventListener('DOMContentLoaded', () => {
  const tableEl        = document.querySelector('.general-actions-table');
  const topbarCountEl  = document.querySelector('.general-actions-top-bar-right-side');
  const arrowLeftEl    = document.querySelector('.pagination-arrow-left');
  const arrowRightEl   = document.querySelector('.pagination-arrow-right');
  const pageListEl     = document.querySelector('.quantity-of-pages-roll'); // список с вариантами 10/30/50
  const searchForm  = document.querySelector('.searchbar');
  const searchInput = document.querySelector('#q');
  // --- NEW: массовые операции / выбор строк ---
  const bulkDeleteBtn = document.querySelector('.ga-bulk-delete');
  const pageCounterEl = document.querySelector('.ga-page-counter'); // может отсутствовать — ок
  const masterCheck   = document.querySelector('.ga-master-check');
  const selectedIds   = new Set();
  const addActionBtn = document.querySelector('.ga-add-action');
  addActionBtn?.addEventListener('click', openCreateForm);
  const STATE_LABELS = { active: 'Активна', finished: 'Завершена', inactive: 'Неактивна' };
  const stateLabel = v => STATE_LABELS[v] || STATE_LABELS.active;

  function updateBulkUI() {
    // показать/скрыть кнопку удаления
    if (bulkDeleteBtn) {
      const count = selectedIds.size;
      bulkDeleteBtn.classList.toggle('hidden', count === 0);
      bulkDeleteBtn.textContent = count > 1 ? `⨉ Удалить акции (${count})` : '⨉ Удалить акцию';
    }
    // синхронизация "мастер"-чекбокса
    if (masterCheck && tableEl) {
      const allRowChecks = tableEl.querySelectorAll('.ga-row-check');
      const total = allRowChecks.length;
      const checked = tableEl.querySelectorAll('.ga-row-check:checked').length;
      masterCheck.indeterminate = checked > 0 && checked < total;
      masterCheck.checked = total > 0 && checked === total;
    }
  }

  function clearSelection() {
    selectedIds.clear();
    tableEl?.querySelectorAll('.ga-row-check').forEach(cb => { cb.checked = false; });
    updateBulkUI();
  }

function getSelectedIdsArray() { return Array.from(selectedIds); }


  if (!tableEl) return; // если не на home.html — тихо выходим

  const state = {
    offset: 0,
    limit: getPageSize(),
    lastPageCount: 0,
    q: ''
  };
  const debounce = (fn, ms = 300) => {
    let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  };

  const applySearch = debounce(() => {
    state.q = (searchInput?.value || '').trim();
    state.offset = 0;       // начинаем пагинацию с первой страницы при смене запроса
    loadPage();
  }, 300);

  // ввод — запускаем поиск (с дебаунсом)
  searchInput?.addEventListener('input', applySearch);

  // Enter — не уходим на /search?q=..., а ищем здесь же
  searchForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    applySearch();
  });
  
    // ===== helpers =====
    function escapeHtml(str = '') {
    return String(str)
        .replaceAll('&','&amp;')
        .replaceAll('<','&lt;')
        .replaceAll('>','&gt;')
        .replaceAll('"','&quot;')
        .replaceAll("'",'&#039;');
    }

    function statusIdFor(statusText) {
    const t = (statusText || '').trim();
    if (t === '• Активна')   return 'general-action-status-active';
    if (t === '• Завершена') return 'general-action-status-ended';
    if (t === '• Неактивна') return 'general-action-status-unavailable';
    return '';
    }

    // ===== modal =====
    function ensureModal() {
    if (document.querySelector('.ga-modal-overlay')) return;
    const wrap = document.createElement('div');
    wrap.className = 'ga-modal-overlay hidden';
    wrap.innerHTML = `
        <div class="ga-modal">
        <button class="ga-modal-close" title="Закрыть">×</button>
        <div class="ga-modal-content"></div>
        <div class="ga-modal-copy-block">
        <button class="ga-modal-copy-admin hidden">Скопировать</button></div>
        </div>
    `;
    document.body.appendChild(wrap);

    // события модалки
    wrap.addEventListener('click', (e) => {
        if (e.target.classList.contains('ga-modal-overlay') || e.target.classList.contains('ga-modal-close')) {
        closeModal();
        }
    });
    wrap.querySelector('.ga-modal-copy-admin').addEventListener('click', async () => {
        const text = wrap.querySelector('.ga-modal-content').innerText;
        try {
            await navigator.clipboard.writeText(text);
            // мини-обратная связь
            const btn = wrap.querySelector('.ga-modal-copy-admin');
            const old = btn.textContent;
            btn.textContent = 'Скопировано!';
            setTimeout(() => (btn.textContent = old), 900);
        } catch {
            alert('Не удалось скопировать :(');
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });

    // делегирование кликов по кнопкам "Скопировать" внутри аккордеона
    document.addEventListener('click', async (ev) => {
      const btn = ev.target.closest('.ga-acc-copy-admin');
      if (!btn) return;

      const wrap = btn.closest('.ga-acc-content');
      const answerEl = wrap && wrap.querySelector('.ga-acc-answer');
      const text = answerEl ? (answerEl.getAttribute('data-answer') || answerEl.textContent || '') : '';

      try {
        await navigator.clipboard.writeText(text);
        btn.textContent = 'Скопировано!';
        setTimeout(() => (btn.textContent = 'Скопировать'), 1200);
      } catch {
        // fallback — выделение и подсказка
        const r = document.createRange();
        r.selectNodeContents(answerEl);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(r);
        alert('Скопируйте выделенный текст (Ctrl/Cmd+C)');
      }
    });

    // делегирование кликов по кнопкам "Удалить" внутри аккордеона FAQ
    document.addEventListener('click', async (ev) => {
      const btn = ev.target.closest('.ga-acc-delete-admin');
      if (!btn) return;

      const item = btn.closest('.ga-acc-item');
      if (!item) return;

      const qaId = item.dataset.qa;
      if (!qaId) {
        alert('Не найден идентификатор вопроса.');
        return;
      }

      const ok = confirm('Удалить этот вопрос?');
      if (!ok) return;

      try {
        btn.disabled = true;

        const res = await fetch(`/api/v1/common_actions/qa/${qaId}`, {
          method: 'DELETE',
          credentials: 'include'
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          throw new Error(errText || 'Не удалось удалить вопрос');
        }

        // Убираем вопрос из DOM
        const accordion = item.closest('.ga-accordion');
        item.remove();

        // Если вопросов не осталось — показываем заглушку (как в случае, когда их нет изначально)
        if (accordion && !accordion.querySelector('.ga-acc-item')) {
          accordion.insertAdjacentHTML(
            'beforebegin',
            `<div class="ga-faq-empty">Нет одобренных вопросов</div>`
          );
          accordion.remove();
        }
      } catch (err) {
        alert(err?.message || 'Ошибка при удалении вопроса');
      } finally {
        btn.disabled = false;
      }
    });


    document.addEventListener('click', async (e) => {
      // Открыть форму добавления
      const addFaqBtn = e.target.closest('#button-add-faq-admin');
      if (addFaqBtn) {
        const overlay = document.querySelector('.ga-modal-overlay');
        openFaqForm(overlay?.dataset.actionId);
        return;
      }

      // Отменить — (ТОЛЬКО внутри формы FAQ) вернуться к списку FAQ
      const cancelBtn = e.target.closest('.ga-faq-form .ga-btn-cancel');
      if (cancelBtn) {
        const overlay = document.querySelector('.ga-modal-overlay');
        const raw = overlay?.dataset.faqRaw;
        if (raw) {
          try {
            const list = JSON.parse(raw);
            openModalHtml(buildFaqAccordionHtml(list));
          } catch {
            closeModal();
          }
        } else {
          closeModal();
        }
        // важно: не даём другим document-обработчикам отработать на этот клик
        e.stopImmediatePropagation?.();
        return;
      }

      // Отправить на согласование
      const submitBtn = e.target.closest('.ga-btn-submit-admin');
      if (submitBtn) {
        const overlay = document.querySelector('.ga-modal-overlay');
        const actionId = overlay?.dataset.actionId;
        const qEl = overlay.querySelector('#faq-q');
        const aEl = overlay.querySelector('#faq-a');
        const who_sent = (window.CURRENT_USER).email.toString()

        const question = (qEl?.value || '').trim();
        const answer = (aEl?.value || '').trim();
        const is_approved = true;

        if (!question) {
          qEl?.classList.add('ga-field-error');
          qEl?.focus();
          return;
        }

        try {
          const url = `/api/v1/common_actions/${actionId}/qa/`;
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ question, answer: answer || null, is_approved, who_sent})
          });

          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || `HTTP ${res.status}`);
          }

          openModalHtml(`<div class="ga-faq-success">FAQ добавлен!</div>`);
        } catch (err) {
          alert('Не удалось отправить: ' + (err?.message || err));
        }
        return;
      }
    });


    }

    function openModal({ text = '', withCopy = false }) {
        ensureModal();
        const overlay = document.querySelector('.ga-modal-overlay');
        const content = overlay.querySelector('.ga-modal-content');
        const copyBtn = overlay.querySelector('.ga-modal-copy-admin');

        content.textContent = text;       // сохраняем переносы
        copyBtn.classList.toggle('hidden', !withCopy);

        overlay.classList.remove('hidden');
        document.body.classList.add('ga-modal-lock');
    }

    function closeModal() {
        const overlay = document.querySelector('.ga-modal-overlay');
        if (!overlay) return;
        overlay.classList.add('hidden');
        overlay.classList.remove('ga-modal--preserve'); // <— сброс режима
        document.body.classList.remove('ga-modal-lock');
    }

    // безопасное экранирование (у тебя уже есть escapeHtml/esc — используй одну из них)

    /** Собирает HTML аккордеонов по списку Q/A */
    function buildFaqAccordionHtml(list) {
      const approved = (Array.isArray(list) ? list : []).filter(x => x && x.is_approved);

      const addBtn = `<div class="ga-faq-add-wrap">
        <button type="button" id="button-add-faq-admin">+ Добавить частый вопрос</button>
      </div>`;

      if (!approved.length) {
        return `<div class="ga-faq-empty">Нет одобренных вопросов</div>` + addBtn;
      }

      const items = approved.map((qa) => {
        const q = esc(qa.question || 'Вопрос');
        const a = esc(qa.answer || '');
        const id = qa.id; // QuestionAnswerOut.id приходит с бэка

        return `
          <details class="ga-acc-item" data-qa="${id}">
            <summary class="ga-acc-summary-admin">
              <span class="ga-acc-q">${q}</span>
            </summary>
            <div class="ga-acc-content">
              <div class="ga-acc-answer" data-answer="${a}">${a}</div>
              <div class="ga-acc-copy-block">
                <button type="button" class="ga-acc-copy-admin">Скопировать</button>
                <button type="button" class="ga-acc-delete-admin">Удалить</button>
              </div>
            </div>
          </details>
        `;
      }).join('');

      return `<div class="ga-accordion">${items}</div>` + addBtn;
    }


    function openModalAnswerText(text) {
      ensureModal();
      const overlay = document.querySelector('.ga-modal-overlay');
      const content = overlay.querySelector('.ga-modal-content');
      const copyBtn = overlay.querySelector('.ga-modal-copy-admin');

      // включаем режим "сохранить форматирование"
      overlay.classList.add('ga-modal--preserve');

      // выводим как <pre>, чтобы табы/разметка не плыли
      content.innerHTML = `<pre class="ga-modal-pre">${esc(String(text || ''))}</pre>`;

      copyBtn.classList.remove('hidden'); // если нужна общая кнопка "Скопировать"
      overlay.classList.remove('hidden');
      document.body.classList.add('ga-modal-lock');
    }

    function openFaqForm(actionId) {
      ensureModal();
      const overlay = document.querySelector('.ga-modal-overlay');
      const content = overlay.querySelector('.ga-modal-content');
      const copyBtn = overlay.querySelector('.ga-modal-copy-admin');

      overlay.classList.remove('ga-modal--preserve'); // обычный режим
      overlay.dataset.actionId = String(actionId || overlay.dataset.actionId || '');

      content.innerHTML = `
        <div class="ga-faq-form">
          <div class="ga-field">
            <label for="faq-q">Вопрос клиента</label>
            <textarea id="faq-q" rows="4" maxlength="1000" placeholder="Введите вопрос…"></textarea>
          </div>
          <div class="ga-field">
            <label for="faq-a">Ответ</label>
            <textarea id="faq-a" rows="6" maxlength="1000" placeholder="Введите ответ (необязательно)"></textarea>
          </div>
          <div class="ga-form-actions">
            <button type="button" class="ga-btn ga-btn-cancel">Отменить</button>
            <button type="button" class="ga-btn ga-btn-submit-admin">Сохранить</button>
          </div>
        </div>
      `;

      copyBtn.classList.add('hidden');
      overlay.classList.remove('hidden');
      document.body.classList.add('ga-modal-lock');
    }

    /** Открывает модалку с произвольным HTML-контентом */
    function openModalHtml(html) {
      ensureModal();
      const overlay = document.querySelector('.ga-modal-overlay');
      const content = overlay.querySelector('.ga-modal-content');
      const copyBtn = overlay.querySelector('.ga-modal-copy-admin');

      overlay.classList.remove('ga-modal--preserve'); // <— ВАЖНО
      content.innerHTML = html;
      copyBtn.classList.add('hidden'); // общая кнопка не нужна — копирование на каждом ответе

      overlay.classList.remove('hidden');
      document.body.classList.add('ga-modal-lock');
    }



  function getPageSize() {
    // пробуем взять число с «кнопки» дропдауна, иначе из выбранного li, иначе 10
    const btn = document.querySelector('.quantity-of-pages-button');
    const valFromBtn = parseInt(btn?.textContent?.trim(), 10);
    if (Number.isFinite(valFromBtn)) return valFromBtn;

    const selectedLi = document.querySelector('.quantity-of-pages-roll li.amount-of-pages-selected');
    const valFromLi = parseInt(selectedLi?.textContent?.trim(), 10);
    return Number.isFinite(valFromLi) ? valFromLi : 10;
    // scriptACTIONS.js сам поддерживает UI, мы просто читаем текущее значение
  }

  function fmtDate(d) {
    const dd  = String(d.getDate()).padStart(2, '0');
    const mm  = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy= d.getFullYear();
    return `${dd}.${mm}.${yyyy}`;
  }

  function fmtRange(startIso, endIso) {
    const s = startIso ? new Date(startIso) : null;
    const e = endIso   ? new Date(endIso)   : null;
    const left  = s ? fmtDate(s) : '—';
    const right = e ? fmtDate(e) : '—';
    return `${left} - ${right}`;
  }

  function stateText(s) {
    switch ((s || '').toLowerCase()) {
      case 'active':   return '• Активна';
      case 'finished': return '• Завершена';
      case 'inactive': return '• Неактивна';
      default:         return '• —';
    }
  }

  function esc(str) {
    return String(str ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function buildRow(a) {
    const row = document.createElement('div');
    row.className = 'general-actions-table-row';
    row.dataset.id = a.id;

    const range = fmtRange(a.start_time, a.end_time);
    const statusText = stateText(a.state);

    row.innerHTML = `
      <div class="ga-cell-check">
        <input type="checkbox" class="ga-row-check" aria-label="Выбрать акцию">
      </div>

      <div class="general-actions-table-cell-name">
        ${a.is_vip ? `<img src="/static/img/icon_vip.png" alt="vip">` : ``}
        <a class="general-action-link" href="${a.link ? esc(a.link) : '#'}" ${a.link ? `target="_blank" rel="noopener"` : ''} aria-label="${a.name}">${a.name.length <= 17 ? esc(a.name) : esc(a.name.slice(0, 17)+'...')}</a>
      </div>

      <div class="general-actions-table-cell-macros">
        ${!a.answer ? `` : `
          <button class="general-action-macros" title="Макросы" data-answer="${escapeHtml(a.answer)}">
            <img src="/static/img/macros_img.png" alt="macros">
          </button>`}
      </div>

      <div class="general-actions-table-cell-time">${range}</div>

      <div class="general-actions-table-cell-rules">
        ${!a.short_rules ? `` : `
          <button class="general-action-macros" title="краткие-правила" data-answer="${escapeHtml(a.short_rules)}">
            <img src="/static/img/short_rules_icon.png" alt="short_rules">
          </button>`}
      </div>

      <div class="general-actions-table-cell-list">
        ${a.players ? `<a class="regular-action-players" href="${esc(a.players)}" target="_blank" rel="noopener">Список</a>` : ``}
      </div>

      <div class="general-actions-table-cell-faq" data-faq="${escapeHtml(JSON.stringify(a.questions_answers || []))}">
        ${Array.isArray(a.questions_answers) && a.questions_answers.some(item => item.is_approved === true)
          ? `<img src="/static/img/faq_icon.png" alt="faq">`
          : `<img src="/static/img/faq_icon_empty.png" alt="faq">`}
      </div>

      <div class="general-actions-table-cell-status">
        <button class="general-action-status" ${(() => { const _id = statusIdFor(statusText); return _id ? `id="${_id}"` : '' })()}>${statusText}</button>
      </div>

      <div class="ga-cell-actions">
        <button type="button" class="ga-row-menu" title="Действия" aria-haspopup="menu">⋯</button>
      </div>
    `;

    // восстановить выделение, если есть
    const cb = row.querySelector('.ga-row-check');
    if (cb && selectedIds.has(String(a.id))) cb.checked = true;

    return row;
  }


  function render(actions) {
    tableEl.innerHTML = '';
    if (!actions.length) {
      const empty = document.createElement('div');
      empty.className = 'general-actions-table-row';
      empty.innerHTML = `<div class="general-actions-table-cell-name" style="grid-column: 1 / -1; opacity:.7">Нет акций</div>`;
      tableEl.appendChild(empty);
    } else {
      actions.forEach(a => tableEl.appendChild(buildRow(a)));
    }

    const start = actions.length ? state.offset + 1 : 0;
    const end   = state.offset + actions.length;
    // бэкенд сейчас не возвращает total — показываем диапазон без «из N»
    if (topbarCountEl) topbarCountEl.innerHTML = `<span class="pagination-general-for-admin">${start}-${end}</span> из ${end}`;

    // обновим «доступность» стрелок
    if (arrowLeftEl)  arrowLeftEl.disabled  = state.offset <= 0;
    if (arrowRightEl) arrowRightEl.disabled = state.lastPageCount < state.limit;
  }

  async function loadPage() {
    // читаем актуальный limit с UI
    state.limit = getPageSize();

    const base = `/api/v1/common_actions`;
    const url = state.q
      ? `${base}/search?q=${encodeURIComponent(state.q)}&offset=${state.offset}&limit=${state.limit}`
      : `${base}?offset=${state.offset}&limit=${state.limit}`;
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) {
      render([]); // упало? покажем пусто
      return;
    }
    let data = await res.json();

    // home.html — это «общие», отфильтруем возможные VIP
    data = Array.isArray(data) ? data : [];

    state.lastPageCount = data.length;
    render(data);
  }

  // Пагинация: стрелки
  arrowLeftEl?.addEventListener('click', () => {
    if (state.offset <= 0) return;
    state.offset = Math.max(0, state.offset - state.limit);
    loadPage();
  });

  arrowRightEl?.addEventListener('click', () => {
    // если на предыдущем запросе пришло меньше, чем limit — дальше ничего нет
    if (state.lastPageCount < state.limit) return;
    state.offset += state.limit;
    loadPage();
  });

  // Смена «кол-ва на странице» (10/30/50) — пересчитать и перейти на первую страницу
  pageListEl?.addEventListener('click', (e) => {
    const li = e.target.closest('li');
    if (!li) return;
    // scriptACTIONS.js сам поменяет кнопку и класс selected; мы просто подстроимся
    state.offset = 0;
    // небольшая задержка, чтобы scriptACTIONS успел обновить кнопки
    setTimeout(loadPage, 0);
  });
    // Делегирование кликов по таблице
    tableEl.addEventListener('click', (e) => {
    // 1) Макросы: кнопка .general-action-macros
    const macroBtn = e.target.closest('.general-action-macros');
    if (macroBtn) {
        const answer = macroBtn.dataset.answer || '';
        openModalAnswerText(answer);
        return;
    }

    // 2) FAQ: ячейка .general-actions-table-cell-faq
    const faqCell = e.target.closest('.general-actions-table-cell-faq');
    if (faqCell) {
      const raw = faqCell.dataset.faq || '[]';
      let list = [];
      try { list = JSON.parse(raw); } catch (err) { console.error('Bad FAQ JSON:', err); }

      const html = buildFaqAccordionHtml(list);
      openModalHtml(html);

      // привяжем к модалке action_id и исходный JSON FAQ — пригодится для "Отменить"
      const overlay = document.querySelector('.ga-modal-overlay');
      const row = faqCell.closest('.general-actions-table-row');
      overlay.dataset.actionId = row?.dataset.id || '';
      overlay.dataset.faqRaw = raw;
      return;
    }


    });

    // === Выбор строк ===
  tableEl?.addEventListener('change', (e) => {
    const cb = e.target.closest('.ga-row-check');
    if (!cb) return;
    const row = cb.closest('.general-actions-table-row');
    const id  = row?.dataset.id;
    if (!id) return;
    if (cb.checked) selectedIds.add(String(id)); else selectedIds.delete(String(id));
    updateBulkUI();
  });

  // «мастер»-чекбокс
  masterCheck?.addEventListener('change', () => {
    const all = tableEl?.querySelectorAll('.general-actions-table-row') || [];
    const wantCheck = !!masterCheck.checked;
    selectedIds.clear();
    all.forEach(row => {
      const id = row.dataset.id;
      const cb = row.querySelector('.ga-row-check');
      if (cb) cb.checked = wantCheck;
      if (wantCheck && id) selectedIds.add(String(id));
    });
    updateBulkUI();
  });

  // === Массовое удаление ===
  async function deleteOneAction(id) {
    const res = await fetch(`/api/v1/common_actions/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    if (!res.ok) throw new Error('DELETE failed');
  }

  bulkDeleteBtn?.addEventListener('click', async () => {
    const ids = getSelectedIdsArray();
    if (!ids.length) return;
    const ok = confirm(ids.length > 1
      ? `Удалить выбранные акции (${ids.length} шт.)?`
      : `Удалить выбранную акцию?`);
    if (!ok) return;

    try {
      // удаляем по одной, чтобы не зависеть от отсутствия batch-ручки
      for (const id of ids) {
        await deleteOneAction(id);
      }
    } catch (err) {
      alert('Не удалось удалить одну или несколько акций. Обновите страницу и попробуйте ещё раз.');
    }
    clearSelection();
    loadPage();
  });

  // === Контекст-меню на троеточии ===
  let openMenuEl = null;
  function closeRowMenu() {
    openMenuEl?.remove();
    openMenuEl = null;
  }

  tableEl?.addEventListener('click', async (e) => {
    // открыть меню
    const menuBtn = e.target.closest('.ga-row-menu');
    if (menuBtn) {
      e.stopPropagation();
      closeRowMenu();
      const row = menuBtn.closest('.general-actions-table-row');
      const id = row?.dataset.id;
      if (!id) return;

      const menu = document.createElement('div');
      menu.className = 'ga-row-menu-popup';
      menu.style.position = 'absolute';
      const rect = menuBtn.getBoundingClientRect();
      menu.style.left = `${rect.left + window.scrollX}px`;
      menu.style.top  = `${rect.bottom + window.scrollY + 4}px`;
      menu.style.background = '#1e1e1e';
      menu.style.border = '1px solid #2e2e2e';
      menu.style.borderRadius = '8px';
      menu.style.padding = '6px';
      menu.style.zIndex = '9999';
      menu.innerHTML = `
        <button type="button" class="ga-menu-edit">Редактировать</button>
        <button type="button" class="ga-menu-delete">Удалить</button>
      `;
      document.body.appendChild(menu);
      openMenuEl = menu;

      // клики по пунктам
      menu.addEventListener('click', async (evt) => {
        const target = evt.target;
        if (target.closest('.ga-menu-delete')) {
          closeRowMenu();
          const ok = confirm('Удалить акцию?');
          if (!ok) return;
          try {
            await deleteOneAction(id);
            selectedIds.delete(String(id));
            loadPage();
          } catch {
            alert('Не удалось удалить акцию.');
          }
        } else if (target.closest('.ga-menu-edit')) {
          closeRowMenu();
          openEditForm(id);
        }
      });
    }
  });

  // клик вне меню — закрыть
  document.addEventListener('click', () => closeRowMenu());
  window.addEventListener('scroll', () => closeRowMenu());
  window.addEventListener('resize', () => closeRowMenu());

  // === Форма редактирования в модалке ===
  // Переиспользую твою .ga-modal — ensureModal() уже есть в файле.
  async function fetchAction(id) {
    const res = await fetch(`/api/v1/common_actions/${id}`, { credentials: 'include' });
    if (!res.ok) throw new Error('GET failed');
    return await res.json();
  }

  function openEditForm(id) {
    ensureModal(); // есть в файле
    const overlay = document.querySelector('.ga-modal-overlay');
    delete overlay.dataset.faqRaw;
    const content = overlay.querySelector('.ga-modal-content');
    const copyBtn = overlay.querySelector('.ga-modal-copy-admin');
    copyBtn?.classList.add('hidden'); // кнопка копировать тут не нужна
    overlay.classList.remove('ga-modal--preserve'); // обычный режим

    // пока ждём — поставим спиннер-текст
    content.innerHTML = `<div style="padding:16px 8px;">Загрузка...</div>`;
    overlay.classList.remove('hidden');
    document.body.classList.add('ga-modal-lock');

    (async () => {
      let a;
      try {
        a = await fetchAction(id);
        console.log(">>>> " + a)
      } catch {
        content.innerHTML = `<div style="padding:16px 8px;color:#ff5b5b;">Не удалось загрузить акцию</div>`;
        return;
      }

      const dt = (v) => v ? new Date(v) : null;
      const toInputDate = (d) => d ? new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().slice(0,16) : '';

      content.innerHTML = `
        <form class="ga-edit-form" data-id="${id}">
          <label>Название <input name="name" type="text" value="${esc(a.name||'')}" required></label>
          <label>Название в Backoffice <input name="name_bo" type="text" value="${esc(a.name_bo || '')}"></label>
          <label>Ссылка <input name="link" type="url" value="${esc(a.link||'')}"></label>
          <div class="block-short-rules">
            <label>Краткие правила</label><textarea name="short_rules" rows="3">${esc(a.short_rules||'')}</textarea>
          </div>
          <div class="block-answer">
            <label>Ответ клиенту</label><textarea name="answer" rows="4">${esc(a.answer||'')}</textarea>
          </div>
          <label>Список участников/победителей (URL) <input name="players" type="url" value="${esc(a.players||'')}"></label>
          <div class="block-start-end">
            <label>Начало <input name="start_time" type="datetime-local" value="${toInputDate(dt(a.start_time))}"></label>
            <label>Окончание <input name="end_time" type="datetime-local" value="${toInputDate(dt(a.end_time))}"></label>
          </div>
          <div class="add-action-state-isvip">
          <label>Статус
            <div class="cs" data-name="state" data-initial="${a.state || 'active'}">
              <button type="button" class="cs-btn" aria-haspopup="listbox" aria-expanded="false">
                ${stateLabel(a.state)}
              </button>
              <div class="cs-list hidden" role="listbox">
                <button type="button" class="cs-option ${a.state==='active'?'is-selected':''}"   data-value="active">Активна</button>
                <button type="button" class="cs-option ${a.state==='finished'?'is-selected':''}" data-value="finished">Завершена</button>
                <button type="button" class="cs-option ${a.state==='inactive'?'is-selected':''}" data-value="inactive">Неактивна</button>
              </div>
              <!-- скрытый нативный select для FormData -->
              <select name="state" class="cs-native" tabindex="-1" aria-hidden="true">
                <option value="active"   ${a.state==='active'?'selected':''}>Активна</option>
                <option value="finished" ${a.state==='finished'?'selected':''}>Завершена</option>
                <option value="inactive" ${a.state==='inactive'?'selected':''}>Неактивна</option>
              </select>
            </div>
          </label>
            <label>
              <input type="checkbox" name="is_vip" ${a.is_vip ? 'checked' : ''}> VIP
            </label>
          </div>
          <div  class="ga-buttons-panel">
            <button type="button" class="ga-btn-cancel">Отменить</button>
            <button type="submit" class="ga-btn-submit-admin">Сохранить</button>
          </div>
        </form>
      `;
      initCustomSelect(content);
    })();
  }

  function openCreateForm() {
    ensureModal();
    const overlay = document.querySelector('.ga-modal-overlay');
    delete overlay.dataset.faqRaw;
    const content = overlay.querySelector('.ga-modal-content');
    const copyBtn = overlay.querySelector('.ga-modal-copy-admin');
    copyBtn?.classList.add('hidden');       // копирование здесь не нужно
    overlay.classList.remove('ga-modal--preserve');

    // хелпер для input[type=datetime-local]
    const toInputDate = (d) => d ? new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().slice(0,16) : '';

    // пустая форма (без data-id => submit поймёт, что это СОЗДАНИЕ)
    content.innerHTML = `
      <form class="ga-edit-form">
        <label>Название <input name="name" type="text" value="" required></label>
        <label>Название в Backoffice <input name="name_bo" type="text" value=""></label>
        <label>Ссылка <input name="link" type="url" value=""></label>
        <div class="block-short-rules">
          <label id="label-short-rules">Краткие правила</label><textarea name="short_rules" rows="3"></textarea>
        </div>
        <div class="block-answer">
          <label>Ответ клиенту</label><textarea name="answer" rows="4"></textarea>
        </div>
        <label>Список участников/победителей (URL) <input name="players" type="url" value=""></label>
        <div class="block-start-end">
          <label>Начало <input name="start_time" type="datetime-local" value=""></label>
          <!-- на создание end_time нужно обязательно -->
          <label>Окончание <input name="end_time" type="datetime-local" value="" required></label>
        </div>
        <div class="add-action-state-isvip">
        <label>Статус
          <div class="cs" data-name="state" data-initial="active">
            <button type="button" class="cs-btn" aria-haspopup="listbox" aria-expanded="false">Активна</button>
            <div class="cs-list hidden" role="listbox">
              <button type="button" class="cs-option is-selected" data-value="active">• Активна</button>
              <button type="button" class="cs-option" data-value="finished">• Завершена</button>
              <button type="button" class="cs-option" data-value="inactive">• Неактивна</button>
            </div>
            <!-- скрытый нативный select для корректной отправки формы -->
            <select name="state" class="cs-native" tabindex="-1" aria-hidden="true">
              <option value="active" selected>• Активна</option>
              <option value="finished">• Завершена</option>
              <option value="inactive">• Неактивна</option>
            </select>
          </div>
        </label>
          <label>
            <input type="checkbox" name="is_vip"> VIP
          </label>
        </div>
        <div class="ga-buttons-panel">
          <button type="button" class="ga-btn-cancel">Отменить</button>
          <button type="submit" class="ga-btn-submit-admin">Создать</button>
        </div>
      </form>
    `;

    initCustomSelect(content);
    overlay.classList.remove('hidden');
    document.body.classList.add('ga-modal-lock');
  }


  // submit формы редактирования
  document.addEventListener('submit', async (e) => {
    const form = e.target.closest('.ga-edit-form');
    if (!form) return;
    e.preventDefault();

    const id = form.dataset.id;
    const fd = new FormData(form);

        // --- ПРОВЕРКА длины поля "Ответ клиенту" ---
    const answerValue = (fd.get('answer') ?? '').toString();
    const ANSWER_MAX_LEN = 1500;

    if (answerValue.length > ANSWER_MAX_LEN) {
      alert(
        `Поле "Ответ клиенту" не должно превышать ${ANSWER_MAX_LEN} символов.\n` +
        `Сейчас: ${answerValue.length}.`
      );
      // Не отправляем запрос на бэкенд, пока пользователь не укоротит текст
      return;
    }
    // --- КОНЕЦ ПРОВЕРКИ ---


    function asNaiveLocal(dtStr) {
      if (!dtStr) return undefined; // пусть поле пропустится
      // <input type="datetime-local"> обычно даёт 'YYYY-MM-DDTHH:MM'
      // Добавим секунды, если их нет, и НЕ трогаем таймзону
      return dtStr.length === 16 ? dtStr + ':00' : dtStr; // 'YYYY-MM-DDTHH:MM:SS'
    }

    const payload = {
      name:        fd.get('name')?.toString().trim() || undefined,
      name_bo:     fd.get('name_bo')?.toString().trim() || undefined,
      link:        fd.get('link')?.toString().trim() || undefined,
      short_rules: fd.get('short_rules')?.toString() || undefined,
      answer:      fd.get('answer')?.toString() || undefined,
      players:     fd.get('players')?.toString().trim() || undefined,
      start_time:  asNaiveLocal(fd.get('start_time')?.toString()),
      end_time:    asNaiveLocal(fd.get('end_time')?.toString()),
      state:       fd.get('state')?.toString() || undefined,
      is_vip:      form.querySelector('input[name="is_vip"]')?.checked ?? undefined
    };

    try {
      const isCreate = !id; // если формы без data-id — это создание
      const url     = isCreate ? `/api/v1/common_actions/` : `/api/v1/common_actions/${id}`;
      const method  = isCreate ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        // удобнее показать причину, если backend вернул detail
        let msg = `${method} failed`;
        try { const j = await res.json(); if (j?.detail) msg = j.detail; } catch {}
        throw new Error(msg);
      }
    } catch (err) {
      alert(`Не удалось сохранить изменения: ${err.message || err}`);
      return;
    }


    // закрыть модалку (в проекте уже есть крестик/логика закрытия)
    const overlay = document.querySelector('.ga-modal-overlay');
    overlay?.classList.add('hidden');
    document.body.classList.remove('ga-modal-lock');

    loadPage();
  });

  // кнопка "Отменить" в форме редактирования
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.ga-btn-cancel');
    if (!btn) return;
    if (btn.closest('.ga-faq-form')) return; // пусть пункт 1 обработает
    const overlay = document.querySelector('.ga-modal-overlay');
    overlay?.classList.add('hidden');
    document.body.classList.remove('ga-modal-lock');
  });

  // Простой кастомный select, синхронизирует скрытый <select name="...">
    function initCustomSelect(scope = document) {
      scope.querySelectorAll('.cs').forEach(cs => {
        if (cs.__init) return; // чтобы не инициализировать дважды
        cs.__init = true;

        const native = cs.querySelector('.cs-native');
        const btn    = cs.querySelector('.cs-btn');
        const list   = cs.querySelector('.cs-list');
        const opts   = Array.from(cs.querySelectorAll('.cs-option'));

        // выставим начальное значение
        const initial = cs.getAttribute('data-initial') || native?.value || opts[0]?.dataset.value || '';
        setValue(initial, false);

        function setValue(v, fire = true) {
          // UI: пометка выбранного + текст на кнопке
          opts.forEach(o => o.classList.toggle('is-selected', o.dataset.value === v));
          const label = (opts.find(o => o.dataset.value === v)?.textContent || '').trim();
          if (label) btn.textContent = label;

          // sync с нативным select (уходит в FormData)
          if (native) {
            native.value = v;
            // подстрахуемся: если такого option нет — проставим selected вручную
            const nopt = Array.from(native.options).find(o => o.value === v);
            if (nopt) nopt.selected = true;
          }

          if (fire) btn.dispatchEvent(new Event('change', {bubbles:true}));
        }

        btn.addEventListener('click', () => {
          const expanded = btn.getAttribute('aria-expanded') === 'true';
          btn.setAttribute('aria-expanded', String(!expanded));
          list.classList.toggle('hidden', expanded);
        });

        opts.forEach(o => {
          o.addEventListener('click', () => {
            setValue(o.dataset.value);
            // закрыть список
            btn.setAttribute('aria-expanded', 'false');
            list.classList.add('hidden');
          });
        });

        // Закрытие по клику вне
        document.addEventListener('click', (e) => {
          if (!cs.contains(e.target)) {
            btn.setAttribute('aria-expanded', 'false');
            list.classList.add('hidden');
          }
        });

        // Закрытие по Esc
        cs.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') {
            btn.setAttribute('aria-expanded', 'false');
            list.classList.add('hidden');
            btn.focus();
          }
        });
      });
    }

const qaApprovingBtn = document.getElementById('qa-approving');
qaApprovingBtn?.addEventListener('click', openFaqModeration);

// 2) Открыть модалку и подтянуть данные
async function openFaqModeration() {
  ensureModal();
  const overlay = document.querySelector('.ga-modal-overlay');
  const content = overlay.querySelector('.ga-modal-content');

  overlay.classList.remove('hidden');
  document.body.classList.add('ga-modal-lock');
  content.innerHTML = `<div class="ga-faq-empty">Загрузка…</div>`;

  // backend: GET /api/v1/common_actions/qas/unapproved_qas -> [QuestionAnswerOut]
  let items = [];
  try {
    const res = await fetch(`/api/v1/common_actions/qas/unapproved_qas`, { credentials: 'include' });
    if (res.ok) {
      items = await res.json();
    } else {
      items = [];
    }
  } catch {
    items = [];
  }

  if (!Array.isArray(items) || items.length === 0) {
    openModalHtml(`<div class="ga-faq-empty">Новых вопросов нет</div>`);
    return;
  }

  // Получаем названия акций для обложек аккордеонов
  const uniqActionIds = [...new Set(items.map(x => x?.action_id).filter(Boolean))];
  const nameMap = {};
  await Promise.all(uniqActionIds.map(async (id) => {
    try {
      const r = await fetch(`/api/v1/common_actions/${id}`, { credentials: 'include' });
      if (r.ok) {
        const a = await r.json();
        nameMap[id] = a?.name || `Акция #${id}`;
      } else {
        nameMap[id] = `Акция #${id}`;
      }
    } catch {
      nameMap[id] = `Акция #${id}`;
    }
  }));

  const html = buildModerationAccordionHtml(items, nameMap);
  openModalHtml(html);
}

// 3) Разметка аккордеонов модерации (по одному на каждый вопрос)
function buildModerationAccordionHtml(list, nameMap) {
  const esc = escapeHtml;
  const items = list.map(qa => {
    const actionName = esc(nameMap[qa.action_id] ?? `Акция #${qa.action_id}`);
    const q = esc(qa.question ?? '');
    const a = esc(qa.answer ?? '');
    return `
      <details class="ga-acc-item qa-mod-item" data-qa="${qa.id}" data-action="${qa.action_id}">
        <summary class="ga-acc-summary-admin">
          <span class="ga-acc-q">${actionName}</span>
          <span class="ga-acc-id">QA #${qa.id}</span>
        </summary>
        <div class="ga-acc-content">
          <div class="ga-field">
            <label>Вопрос клиента</label>
            <textarea class="qa-mod-q" rows="4" maxlength="1000">${q}</textarea>
          </div>
          <div class="ga-field">
            <label>Ответ</label>
            <textarea class="qa-mod-a" rows="6" maxlength="1000">${a}</textarea>
          </div>
          <div class="ga-form-actions">
            <!-- стилизуем одинаково под твои кнопки админа -->
            <button type="button" class="ga-btn-submit-admin" data-act="approve">Одобрить</button>
            <button type="button" id="delete-qa" class="ga-btn-submit-admin" data-act="delete">Удалить</button>
          </div>
        </div>
      </details>
    `;
  }).join('');

  return `<div class="ga-accordion">${items}</div>`;
}

// 4) Делегирование кликов: Одобрить / Удалить
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('.ga-btn-submit-admin[data-act]');
  if (!btn) return;

  const item = btn.closest('.qa-mod-item');
  if (!item) return; // это не наша модерация

  const qaId = item.dataset.qa;
  const qEl = item.querySelector('.qa-mod-q');
  const aEl = item.querySelector('.qa-mod-a');
  const question = (qEl?.value || '').trim();
  const answer   = (aEl?.value || '').trim();
  const act = btn.dataset.act;

  try {
    btn.disabled = true;

    if (act === 'approve') {
      // сначала обновим текст, затем одобрим
      await fetch(`/api/v1/common_actions/qa/${qaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ question, answer: answer || null })
      });

      const ok = await fetch(`/api/v1/common_actions/qa/${qaId}/approve`, {
        method: 'PATCH',
        credentials: 'include'
      });
      if (!ok.ok) throw new Error('Не удалось одобрить');

      item.remove();
    }

    if (act === 'delete') {
      const del = await fetch(`/api/v1/common_actions/qa/${qaId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!del.ok) throw new Error('Не удалось удалить');

      item.remove();
    }

    // если ничего не осталось — покажем заглушку
    if (!document.querySelector('.qa-mod-item')) {
      openModalHtml(`<div class="ga-faq-empty">Новых вопросов нет</div>`);
    }
  } catch (err) {
    alert(err?.message || err);
  } finally {
    btn.disabled = false;
  }
});

  // первый рендер
  loadPage();
});
