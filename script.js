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
let expenseFilter = false;
const formatCurrency = amount => '₹' + Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatCompact = amount => '₹' + Number(amount).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const list = document.querySelector('#transaction-list');

function renderTransactions() {
  const visible = transactions.filter(item => !expenseFilter || item.type === 'expense');
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
  expenseFilter = false;
  document.querySelector('#filter-button').innerHTML = '<svg viewBox="0 0 24 24"><path d="M4 6h16M7 12h10m-7 6h4"/></svg>Filter<span class="filter-chevron">⌄</span>';
  renderTransactions();
  event.currentTarget.reset();
  modal.close();
});
document.querySelector('#show-more').addEventListener('click', () => { showAll = !showAll; renderTransactions(); });
document.querySelector('#filter-button').addEventListener('click', event => {
  expenseFilter = !expenseFilter;
  event.currentTarget.innerHTML = expenseFilter ? '<svg viewBox="0 0 24 24"><path d="M4 6h16M7 12h10m-7 6h4"/></svg>Expenses<span class="filter-chevron">×</span>' : '<svg viewBox="0 0 24 24"><path d="M4 6h16M7 12h10m-7 6h4"/></svg>Filter<span class="filter-chevron">⌄</span>';
  renderTransactions();
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
document.querySelector('.search-button').addEventListener('click', () => {
  const query = window.prompt('Search transactions');
  if (query === null) return;
  const matched = transactions.filter(item => item.title.toLowerCase().includes(query.toLowerCase()) || item.category.toLowerCase().includes(query.toLowerCase()));
  list.innerHTML = matched.length ? matched.map(item => `<div class="transaction-row"><div class="transaction-main"><span class="transaction-icon ${item.tint}">${item.icon}</span><div><div class="transaction-name">${escapeHTML(item.title)}</div><div class="transaction-sub">${item.type === 'income' ? 'Money in' : 'Money out'}</div></div></div><span class="category-chip">${escapeHTML(item.category)}</span><span class="transaction-date">${escapeHTML(item.date)}</span><span class="transaction-amount ${item.type}">${item.type === 'income' ? '+' : '−'}${formatCurrency(item.amount)}</span></div>`).join('') : '<div class="empty-state">No matching transactions.</div>';
});
document.querySelector('.notification-button').addEventListener('click', () => window.alert('You’re all caught up!'));
