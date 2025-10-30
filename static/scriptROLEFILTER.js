// Апгрейд нативного <select id="sa-role-filter"> до кастомного выпадающего списка
(function () {
  const select = document.getElementById("sa-role-filter");
  if (!select) return;

  // Прячем оригинальный select, но оставляем его в DOM (доступность + совместимость)
  select.classList.add("visually-hidden");

  // Контейнер кастомного дропдауна
  const wrap = document.createElement("div");
  wrap.className = "sa-role-dd";

  // Кнопка (отображает текущий выбор)
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "sa-role-dd__btn";
  btn.setAttribute("aria-haspopup", "listbox");
  btn.setAttribute("aria-expanded", "false");

  // Список вариантов
  const list = document.createElement("ul");
  list.className = "sa-role-dd__list";
  list.setAttribute("role", "listbox");
  list.hidden = true;

  // Переносим значения из <select> в наш список
  const options = Array.from(select.options);
  let selectedIndex = select.selectedIndex >= 0 ? select.selectedIndex : 0;

  options.forEach((opt, i) => {
    const li = document.createElement("li");
    li.className = "sa-role-dd__item";
    li.setAttribute("role", "option");
    li.dataset.value = opt.value;
    li.textContent = opt.textContent;
    if (i === selectedIndex) {
      li.classList.add("is-selected");
      btn.textContent = opt.textContent;
      list.setAttribute("aria-activedescendant", opt.value);
    }
    list.appendChild(li);
  });

  // Если в <select> не было выбранного — синхронизируем кнопку
  if (!btn.textContent && options.length) {
    btn.textContent = options[0].textContent;
  }

  // Встраиваем в DOM рядом с исходным select
  select.insertAdjacentElement("afterend", wrap);
  wrap.appendChild(btn);
  wrap.appendChild(list);

  // Вспомогательные функции открытия/закрытия
  function setOpenState(isOpen) {
    list.hidden = !isOpen;
    wrap.classList.toggle("sa-role-dd--open", isOpen);
    btn.setAttribute("aria-expanded", String(isOpen));
  }

  function closeOnOutside(e) {
    if (!wrap.contains(e.target)) setOpenState(false);
  }

  // Выбор пункта
  function choose(value, text) {
    // 1) Переключаем выделение в списке
    list.querySelectorAll(".sa-role-dd__item").forEach(li => li.classList.remove("is-selected"));
    const li = list.querySelector(`.sa-role-dd__item[data-value="${CSS.escape(value)}"]`);
    if (li) li.classList.add("is-selected");

    // 2) Обновляем кнопку
    btn.textContent = text;

    // 3) Синхронизируем с нативным <select> и шлём change
    if (select.value !== value) {
      select.value = value;
      const evt = new Event("change", { bubbles: true });
      select.dispatchEvent(evt);
    }
  }

  // Клики
  btn.addEventListener("click", () => setOpenState(wrap.classList.contains("sa-role-dd--open") ? false : true));
  document.addEventListener("click", closeOnOutside);

  list.addEventListener("click", (e) => {
    const li = e.target.closest(".sa-role-dd__item");
    if (!li) return;
    choose(li.dataset.value, li.textContent);
    setOpenState(false);
  });

  // Синхронизация, если кто-то поменяет select извне (на всякий)
  select.addEventListener("change", () => {
    const opt = select.options[select.selectedIndex];
    if (!opt) return;
    choose(opt.value, opt.textContent);
  });

  // Клавиатура (минимально необходимое)
  wrap.addEventListener("keydown", (e) => {
    const open = wrap.classList.contains("sa-role-dd--open");
    const items = Array.from(list.querySelectorAll(".sa-role-dd__item"));
    const cur = items.findIndex(el => el.classList.contains("is-selected"));

    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!open) {
        setOpenState(true);
      } else {
        const el = items[Math.max(cur, 0)];
        if (el) {
          choose(el.dataset.value, el.textContent);
          setOpenState(false);
        }
      }
    } else if (e.key === "Escape") {
      if (open) setOpenState(false);
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = e.key === "ArrowDown" ? Math.min(cur + 1, items.length - 1) : Math.max(cur - 1, 0);
      items.forEach(el => el.classList.remove("is-focused"));
      const el = items[next];
      if (el) {
        el.classList.add("is-focused");
        el.scrollIntoView({ block: "nearest" });
      }
    }
  });

  // Фокус по табу на кнопку
  btn.addEventListener("keydown", (e) => {
    if ((e.key === "ArrowDown" || e.key === " ") && list.hidden) {
      e.preventDefault();
      setOpenState(true);
    }
  });
})();
