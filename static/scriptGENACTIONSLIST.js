// === COMMON ACTIONS LIST (home.html) ===
document.addEventListener('DOMContentLoaded', () => {
  const tableEl        = document.querySelector('.general-actions-table');
  const topbarCountEl  = document.querySelector('.general-actions-top-bar-right-side');
  const arrowLeftEl    = document.querySelector('.pagination-arrow-left');
  const arrowRightEl   = document.querySelector('.pagination-arrow-right');
  const pageListEl     = document.querySelector('.quantity-of-pages-roll'); // список с вариантами 10/30/50
  const searchForm  = document.querySelector('.searchbar');
  const searchInput = document.querySelector('#q');

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
        <button class="ga-modal-copy hidden">Скопировать</button></div>
        </div>
    `;
    document.body.appendChild(wrap);

    // события модалки
    wrap.addEventListener('click', (e) => {
        if (e.target.classList.contains('ga-modal-overlay') || e.target.classList.contains('ga-modal-close')) {
        closeModal();
        }
    });
    wrap.querySelector('.ga-modal-copy').addEventListener('click', async () => {
        const text = wrap.querySelector('.ga-modal-content').innerText;
        try {
            await navigator.clipboard.writeText(text);
            // мини-обратная связь
            const btn = wrap.querySelector('.ga-modal-copy');
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
      const btn = ev.target.closest('.ga-acc-copy');
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

    document.addEventListener('click', async (e) => {
      // Открыть форму добавления
      const addFaqBtn = e.target.closest('#button-add-faq');
      if (addFaqBtn) {
        const overlay = document.querySelector('.ga-modal-overlay');
        openFaqForm(overlay?.dataset.actionId);
        return;
      }

      // Отменить — вернуться к списку FAQ из сохранённого JSON
      const cancelBtn = e.target.closest('.ga-btn-cancel');
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
        return;
      }

      // Отправить на согласование
      const submitBtn = e.target.closest('.ga-btn-submit');
      if (submitBtn) {
        const overlay = document.querySelector('.ga-modal-overlay');
        const actionId = overlay?.dataset.actionId;
        const qEl = overlay.querySelector('#faq-q');
        const aEl = overlay.querySelector('#faq-a');
        const who_sent = (window.CURRENT_USER).email.toString()

        const question = (qEl?.value || '').trim();
        const answer = (aEl?.value || '').trim();

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
            body: JSON.stringify({ question, answer: answer || null, who_sent})
          });

          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || `HTTP ${res.status}`);
          }

          openModalHtml(`<div class="ga-faq-success">Отправлено на согласование. Спасибо!</div>`);
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
        const copyBtn = overlay.querySelector('.ga-modal-copy');

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
        <button type="button" id="button-add-faq">+ Добавить частый вопрос</button>
      </div>`;

      if (!approved.length) {
        return `<div class="ga-faq-empty">Нет одобренных вопросов</div>` + addBtn;
      }

      const items = approved.map((qa) => {
        const q = esc(qa.question || 'Вопрос');
        const a = esc(qa.answer || '');
        return `
          <details class="ga-acc-item">
            <summary class="ga-acc-summary"><span class="ga-acc-q">${q}</span></summary>
            <div class="ga-acc-content">
              <div class="ga-acc-answer" data-answer="${a}">${a}</div>
              <div class="ga-acc-copy-block"><button type="button" class="ga-acc-copy">Скопировать</button></div>
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
      const copyBtn = overlay.querySelector('.ga-modal-copy');

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
      const copyBtn = overlay.querySelector('.ga-modal-copy');

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
            <button type="button" class="ga-btn ga-btn-submit">Отправить на согласование</button>
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
      const copyBtn = overlay.querySelector('.ga-modal-copy');

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
    console.log(a.questions_answers)

    row.innerHTML = `
      <div class="general-actions-table-cell-name">
        <a class="general-action-link" href="${a.link ? esc(a.link) : '#'}" ${a.link ? `target="_blank" rel="noopener"` : ''}>${a.name.length <= 15 ? esc(a.name) : esc(a.name.slice(0, 20)+'...')}</a>
      </div>
      <div class="general-actions-table-cell-macros">
      ${!a.answer 
        ? ``
        : `<button class="general-action-macros" title="Макросы" data-answer="${escapeHtml(a.answer)}">
        <img src="/static/img/macros_img.png" alt="macros"></button>`}
      </div>
      <div class="general-actions-table-cell-time">${range}</div>
      <div class="general-actions-table-cell-rules">
        ${!a.short_rules
          ? ``
          : `<button class="general-action-macros" title="краткие-правила" data-answer="${escapeHtml(a.short_rules)}">
        <img src="/static/img/short_rules_icon.png" alt="short_rules"></button>`}
      </div>
      <div class="general-actions-table-cell-list">
      ${a.players
          ? `<a class="regular-action-players" href="${esc(a.players)}" target="_blank" rel="noopener">Список</a>`
          : ``}
      </div>
      <div class="general-actions-table-cell-faq" data-faq="${escapeHtml(JSON.stringify(a.questions_answers || []))}">
      ${a.questions_answers.some(item => item.is_approved === true)
        ? `<img src="/static/img/faq_icon.png" alt="faq"></div>`
        : `<img src="/static/img/faq_icon_empty.png" alt="faq"></div>`}
      <div class="general-actions-table-cell-status">
        <button class="general-action-status" ${(() => { const _id = statusIdFor(statusText); return _id ? `id="${_id}"` : '' })()}>${statusText}</button>
      </div>
    `;
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
    if (topbarCountEl) topbarCountEl.innerHTML = `<span class="pagination-general-for-user">${start}-${end}</span> из ${end}`;

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
    data = Array.isArray(data) ? data.filter(a => !a?.is_vip) : [];

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

  // первый рендер
  loadPage();
});
