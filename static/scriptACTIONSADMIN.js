// ВЫПАДАЮЩИЙ СПИСОК С КЛИЧЕСТВОМ СТРАНИЦ
const dd    = document.querySelector('.quantity-of-pages-list');
const btn   = dd.querySelector('.quantity-of-pages-button');
const list  = dd.querySelector('.quantity-of-pages-roll');
const input = dd.querySelector('.amount-of-pages-value');
const items = Array.from(dd.querySelectorAll('.quantity-of-pages-roll li'));

function setOpenState(isOpen) {
  list.hidden = !isOpen;
  dd.classList.toggle('quantity-of-pages-open', isOpen);
}

// Единственный источник правды: текущий <li>
let selectedLi = dd.querySelector('.quantity-of-pages-roll li.amount-of-pages-selected') || items[0];

// Инициализация UI от selectedLi
function syncFromSelected() {
items.forEach(li => li.classList.remove('amount-of-pages-selected'));
selectedLi.classList.add('amount-of-pages-selected');
btn.textContent = selectedLi.textContent.trim();
input.value = selectedLi.dataset.value;
}
syncFromSelected();

// Открыть/закрыть
btn.addEventListener('click', () => {
  setOpenState(list.hidden); // если было скрыто — откроем, если открыто — закроем
});

// Выбор пункта
list.addEventListener('click', (e) => {
    const li = e.target.closest('li');
    if (!li) return;
    selectedLi = li;     // меняем ссылку на текущий пункт
    syncFromSelected();  // пересинхронизируем UI
    setOpenState(false);
});

// Клик вне — закрыть, но не трогать классы
document.addEventListener('click', (e) => {
if (!dd.contains(e.target)) setOpenState(false);
});