const initialTransactions = [
  { title: 'Monthly salary', category: 'Income', date: 'Today, 9:14 AM', amount: 64500, type: 'income', icon: '↗', tint: 'tint-sage' },
  { title: 'Grocery shopping', category: 'Essentials', date: 'Today, 8:32 AM', amount: 2840, type: 'expense', icon: '▤', tint: 'tint-purple' },
  { title: 'Coffee & brunch', category: 'Food & drink', date: 'Yesterday', amount: 680, type: 'expense', icon: '☕', tint: 'tint-peach' },
  { title: 'Uber ride', category: 'Transport', date: 'Yesterday', amount: 420, type: 'expense', icon: '⌁', tint: 'tint-blue' },
  { title: 'Streaming subscription', category: 'Entertainment', date: 'Nov 04, 2025', amount: 499, type: 'expense', icon: '▷', tint: 'tint-pink' },
  { title: 'Weekend dinner', category: 'Food & drink', date: 'Nov 03, 2025', amount: 1250, type: 'expense', icon: '✦', tint: 'tint-yellow' }
];
let transactions = [...initialTransactions];
let showAll = false;
let transactionFilter = 'all';
let searchQuery = '';
const formatCurrency = amount => '₹' + Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatCompact = amount => '₹' + Number(amount).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const list = document.querySelector('#transaction-list');
const nameModal = document.querySelector('#name-modal');
const nameInput = document.querySelector('#user-name-input');
const nameError = document.querySelector('#name-error');
let activeName = (localStorage.getItem('spendly-user-name') || '').trim();

function updateGreeting() {
  const hour = new Date().getHours();
  const greeting = hour >= 5 && hour < 12 ? 'Good morning'
    : hour >= 12 && hour < 17 ? 'Good afternoon'
      : hour >= 17 && hour < 21 ? 'Good evening'
        : 'Good night';
  document.querySelector('#greeting-time').textContent = greeting;
}
updateGreeting();

function displayName(name) {
  activeName = name;
  localStorage.setItem('spendly-user-name', name);
  document.querySelector('#greeting-name').textContent = name;
  document.querySelector('#profile-name').textContent = name;
  const initials = name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  document.querySelector('#profile-initials').textContent = initials;
  document.querySelector('#top-initial').textContent = initials[0] || 'A';
}

if (activeName) {
  displayName(activeName);
} else {
  nameModal.showModal();
}

document.querySelector('#name-form').addEventListener('submit', event => {
  event.preventDefault();
  const name = nameInput.value.trim();
  if (!name) {
    nameError.textContent = 'Please enter a valid name to continue.';
    nameInput.setCustomValidity('Please enter a valid name.');
    nameInput.reportValidity();
    nameInput.focus();
    return;
  }
  nameInput.setCustomValidity('');
  nameError.textContent = '';
  displayName(name);
  nameModal.close();
});

nameInput.addEventListener('input', () => {
  nameInput.setCustomValidity('');
  nameError.textContent = '';
});

document.querySelector('#edit-name').addEventListener('click', () => {
  document.querySelector('#name-modal-title').textContent = 'Update your name';
  document.querySelector('#name-form button[type="submit"]').innerHTML = 'Save name <span>→</span>';
  document.querySelector('#close-name-modal').hidden = false;
  nameInput.value = activeName;
  nameError.textContent = '';
  nameModal.showModal();
  nameInput.focus();
  nameInput.select();
});

document.querySelector('#close-name-modal').addEventListener('click', () => nameModal.close());
nameModal.addEventListener('cancel', event => {
  if (!activeName) event.preventDefault();
});

function renderTransactions() {
  const query = searchQuery.trim().toLowerCase();
  const visible = transactions.filter(item => {
    const matchesFilter = transactionFilter === 'all' || item.type === transactionFilter;
    const matchesSearch = !query || item.title.toLowerCase().includes(query) || item.category.toLowerCase().includes(query);
    return matchesFilter && matchesSearch;
  });
  const shown = showAll ? visible : visible.slice(0, 6);
  list.innerHTML = shown.length ? shown.map(item => `
    <div class="transaction-row">
      <div class="transaction-main"><span class="transaction-icon ${item.tint}">${item.icon}</span><div><div class="transaction-name">${escapeHTML(item.title)}</div><div class="transaction-sub">${item.type === 'income' ? 'Money in' : 'Money out'}</div></div></div>
      <span class="category-chip">${escapeHTML(item.category)}</span><span class="transaction-date">${escapeHTML(item.date)}</span>
      <span class="transaction-amount ${item.type}">${item.type === 'income' ? '+' : '−'}${formatCurrency(item.amount)}</span>
    </div>`).join('') : '<div class="empty-state">No transactions to show yet.</div>';
  document.querySelector('#transaction-count').textContent = `${visible.length} transaction${visible.length === 1 ? '' : 's'}`;
  document.querySelector('#showing-count').textContent = shown.length;
  document.querySelector('#total-count').textContent = visible.length;
  const more = document.querySelector('#show-more');
  more.style.visibility = visible.length > 6 ? 'visible' : 'hidden';
  more.innerHTML = showAll ? 'Show less <span>↑</span>' : 'Show more <span>↓</span>';
  updateSummary();
}

function updateSummary() {
  const income = transactions.filter(item => item.type === 'income').reduce((sum, item) => sum + Number(item.amount), 0);
  const expense = transactions.filter(item => item.type === 'expense').reduce((sum, item) => sum + Number(item.amount), 0);
  document.querySelector('#income-amount').innerHTML = `${formatCurrency(income).replace(/(\.\d{2})$/, '<span>$1</span>')}`;
  document.querySelector('#expense-amount').innerHTML = `${formatCurrency(expense).replace(/(\.\d{2})$/, '<span>$1</span>')}`;
  document.querySelector('#balance-amount').innerHTML = `${formatCurrency(income - expense).replace(/(\.\d{2})$/, '<span>$1</span>')}`;
  document.querySelector('#chart-total').textContent = formatCompact(expense);
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

renderTransactions();

const modal = document.querySelector('#transaction-modal');
document.querySelector('#open-modal').addEventListener('click', () => modal.showModal());
document.querySelector('#close-modal').addEventListener('click', () => modal.close());
document.querySelector('#transaction-form').addEventListener('submit', event => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const type = form.get('type');
  const icons = { 'Food & drink': '☕', Shopping: '▤', Transport: '⌁', Housing: '⌂', Health: '＋', Salary: '↗', Entertainment: '▷', Other: '✦' };
  const tints = { 'Food & drink': 'tint-peach', Shopping: 'tint-purple', Transport: 'tint-blue', Housing: 'tint-sage', Health: 'tint-pink', Salary: 'tint-sage', Entertainment: 'tint-yellow', Other: 'tint-purple' };
  transactions.unshift({ title: form.get('title').trim(), category: form.get('category'), date: 'Just now', amount: Number(form.get('amount')), type, icon: icons[form.get('category')] || '✦', tint: tints[form.get('category')] || 'tint-purple' });
  showAll = false;
  renderTransactions();
  event.currentTarget.reset();
  modal.close();
});
document.querySelector('#show-more').addEventListener('click', () => { showAll = !showAll; renderTransactions(); });
const filterControl = document.querySelector('#filter-control');
const filterToggle = document.querySelector('#filter-toggle');
const filterMenu = document.querySelector('#filter-menu');

function closeFilterMenu(returnFocus = false) {
  filterMenu.hidden = true;
  filterToggle.setAttribute('aria-expanded', 'false');
  if (returnFocus) filterToggle.focus();
}

filterToggle.addEventListener('click', () => {
  const isOpen = !filterMenu.hidden;
  filterMenu.hidden = isOpen;
  filterToggle.setAttribute('aria-expanded', String(!isOpen));
});

filterMenu.addEventListener('click', event => {
  const option = event.target.closest('[data-filter]');
  if (!option) return;

  transactionFilter = option.dataset.filter;
  document.querySelector('#filter-label').textContent = option.textContent;
  filterMenu.querySelectorAll('[data-filter]').forEach(item => {
    const isSelected = item === option;
    item.classList.toggle('is-selected', isSelected);
    item.setAttribute('aria-checked', String(isSelected));
  });
  showAll = false;
  closeFilterMenu(true);
  renderTransactions();
});

document.addEventListener('click', event => {
  if (!filterMenu.hidden && !filterControl.contains(event.target)) closeFilterMenu();
});

filterControl.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !filterMenu.hidden) closeFilterMenu(true);
});
document.querySelector('#view-all').addEventListener('click', () => {
  showAll = true;
  document.querySelector('#transactions').scrollIntoView({ behavior: 'smooth', block: 'start' });
  renderTransactions();
});
document.querySelectorAll('.nav-item').forEach(item => item.addEventListener('click', () => {
  document.querySelectorAll('.nav-item').forEach(link => link.classList.remove('is-active'));
  item.classList.add('is-active');
  document.querySelector('#current-page').textContent = item.dataset.view === 'transactions' ? 'Transactions' : 'Overview';
}));
const searchControl = document.querySelector('#search-control');
const searchButton = document.querySelector('#search-button');
const searchInput = document.querySelector('#transaction-search');
const searchClear = document.querySelector('#search-clear');

searchButton.addEventListener('click', () => searchInput.focus());
searchControl.addEventListener('mouseenter', () => searchControl.classList.remove('is-collapsed'));
searchControl.addEventListener('mouseleave', () => searchControl.classList.remove('is-collapsed'));
searchInput.addEventListener('blur', () => {
  if (!searchInput.value.trim()) searchControl.classList.add('is-collapsed');
});
searchInput.addEventListener('input', () => {
  searchQuery = searchInput.value;
  searchControl.classList.toggle('has-query', Boolean(searchQuery.trim()));
  searchClear.hidden = !searchQuery;
  showAll = false;
  renderTransactions();
});
searchClear.addEventListener('click', () => {
  searchInput.value = '';
  searchQuery = '';
  searchControl.classList.remove('has-query');
  searchClear.hidden = true;
  showAll = false;
  renderTransactions();
  searchInput.focus();
});
searchInput.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    searchInput.value = '';
    searchQuery = '';
    searchControl.classList.remove('has-query');
    searchClear.hidden = true;
    showAll = false;
    renderTransactions();
    searchInput.blur();
  }
});
