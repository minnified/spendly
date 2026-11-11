const transactionStorageKey = 'spendly-transactions';
const savingsGoalsStorageKey = 'spendly-savings-goals';
const legacySavingsGoalStorageKey = 'spendly-savings-goal';
const chartColors = ['#9385cd', '#8fb49e', '#e3b59c', '#829aac', '#d18e9d', '#c1a76d', '#779d9a', '#b28cc3'];

function createTransactionId() {
  return window.crypto?.randomUUID?.() || `transaction-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function saveTransactions(items) {
  localStorage.setItem(transactionStorageKey, JSON.stringify(items));
}

function localDateISO(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isValidDateISO(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function transactionDateISO(item) {
  if (isValidDateISO(item.dateISO)) return item.dateISO;

  const dateText = String(item.date || '');
  const date = new Date();
  if (/^yesterday/i.test(dateText)) date.setDate(date.getDate() - 1);
  else if (!/^(today|just now)/i.test(dateText)) {
    const parsedDate = new Date(dateText);
    if (!Number.isNaN(parsedDate.getTime())) return localDateISO(parsedDate);
  }
  return localDateISO(date);
}

function transactionMonth(item) {
  return item.dateISO.slice(0, 7);
}

function monthLabel(monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function formatTransactionDate(dateISO) {
  const [year, month, day] = dateISO.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (dateISO === localDateISO(today)) return 'Today';
  if (dateISO === localDateISO(yesterday)) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

function loadTransactions() {
  const savedTransactions = localStorage.getItem(transactionStorageKey);
  if (savedTransactions === null) {
    saveTransactions([]);
    return [];
  }

  try {
    const parsedTransactions = JSON.parse(savedTransactions);
    if (!Array.isArray(parsedTransactions)) return [];

    let needsSave = false;
    const loadedTransactions = parsedTransactions
      .filter(item => item && typeof item.title === 'string' && typeof item.category === 'string'
        && ['income', 'expense'].includes(item.type) && Number.isFinite(Number(item.amount)))
      .map(item => {
        const id = item.id !== undefined && item.id !== null && String(item.id)
          ? String(item.id)
          : createTransactionId();
        const dateISO = transactionDateISO(item);
        if (!item.id || item.dateISO !== dateISO) needsSave = true;
        return { ...item, id, dateISO, amount: Number(item.amount) };
      });

    if (needsSave) saveTransactions(loadedTransactions);
    return loadedTransactions;
  } catch {
    return [];
  }
}

function createGoalId() {
  return window.crypto?.randomUUID?.() || `goal-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalizeGoal(goal) {
  const target = Number(goal?.target);
  if (!goal || typeof goal.name !== 'string' || !goal.name.trim() || !Number.isFinite(target) || target <= 0) return null;
  const contributions = Array.isArray(goal.contributions)
    ? goal.contributions.filter(item => item && Number.isFinite(Number(item.amount)) && Number(item.amount) > 0)
      .map(item => ({ amount: Number(item.amount), dateISO: isValidDateISO(item.dateISO) ? item.dateISO : localDateISO() }))
    : [];
  return { id: String(goal.id || createGoalId()), name: goal.name.trim(), target, contributions };
}

function loadSavingsGoals() {
  const savedGoals = localStorage.getItem(savingsGoalsStorageKey);
  try {
    if (savedGoals !== null) {
      const parsedGoals = JSON.parse(savedGoals);
      return Array.isArray(parsedGoals) ? parsedGoals.map(normalizeGoal).filter(Boolean) : [];
    }
    const legacyGoalText = localStorage.getItem(legacySavingsGoalStorageKey);
    if (legacyGoalText) {
      const legacyGoal = normalizeGoal(JSON.parse(legacyGoalText));
      if (legacyGoal) {
        const migrated = [legacyGoal];
        localStorage.setItem(savingsGoalsStorageKey, JSON.stringify(migrated));
        return migrated;
      }
    }
  } catch {
    return [];
  }
  return [];
}

function saveSavingsGoals() {
  localStorage.setItem(savingsGoalsStorageKey, JSON.stringify(savingsGoals));
}

function savingsContributionTotal(goal) {
  const total = goal.contributions.reduce((sum, item) => sum + Number(item.amount), 0);
  return Number(total.toFixed(2));
}

function formatGoalAmount(amount) {
  return `₹${Number(amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function downloadFile(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvCell(value) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function validateBackup(parsed) {
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.transactions) || !Array.isArray(parsed.savingsGoals)) {
    throw new Error('This file does not contain a Spendly backup.');
  }
  const importedTransactions = parsed.transactions.map((item, index) => {
    const amount = Number(item?.amount);
    let dateISO = isValidDateISO(item?.dateISO) ? item.dateISO : '';
    if (!dateISO && typeof item?.date === 'string' && item.date.trim()) {
      if (/^(today|yesterday|just now)$/i.test(item.date.trim())) dateISO = transactionDateISO(item);
      else {
        const parsedDate = new Date(item.date);
        if (!Number.isNaN(parsedDate.getTime())) dateISO = localDateISO(parsedDate);
      }
    }
    if (!item || typeof item.title !== 'string' || !item.title.trim() || typeof item.category !== 'string'
      || !item.category.trim() || !['income', 'expense'].includes(item.type) || !Number.isFinite(amount) || amount <= 0
      || !isValidDateISO(dateISO)) throw new Error(`Transaction ${index + 1} has invalid or missing details.`);
    return { ...item, id: String(item.id || createTransactionId()), title: item.title.trim(), category: item.category.trim(), amount, dateISO, date: formatTransactionDate(dateISO), ...transactionAppearance(item.category.trim()) };
  });
  const transactionIds = new Set();
  importedTransactions.forEach(item => {
    if (transactionIds.has(item.id)) item.id = createTransactionId();
    transactionIds.add(item.id);
  });
  const importedGoals = parsed.savingsGoals.map((goal, index) => {
    const normalized = normalizeGoal(goal);
    if (!normalized) throw new Error(`Savings goal ${index + 1} has invalid or missing details.`);
    if (goal.contributions !== undefined && !Array.isArray(goal.contributions)) throw new Error(`Savings goal ${index + 1} has invalid contributions.`);
    if ((goal.contributions || []).some(item => !item || !Number.isFinite(Number(item.amount)) || Number(item.amount) <= 0)) {
      throw new Error(`Savings goal ${index + 1} has an invalid contribution amount.`);
    }
    if ((goal.contributions || []).some(item => item.dateISO !== undefined && !isValidDateISO(item.dateISO))) {
      throw new Error(`Savings goal ${index + 1} has an invalid contribution date.`);
    }
    return normalized;
  });
  const goalIds = new Set();
  importedGoals.forEach(goal => {
    if (goalIds.has(goal.id)) goal.id = createGoalId();
    goalIds.add(goal.id);
  });
  const userName = parsed.userName === undefined ? '' : parsed.userName;
  if (typeof userName !== 'string' || userName.length > 40) throw new Error('The saved user name is invalid.');
  return { transactions: importedTransactions, savingsGoals: importedGoals, userName: userName.trim() };
}

let transactions = loadTransactions();
let savingsGoals = loadSavingsGoals();
let activeGoalId = null;
let showAll = false;
let transactionFilter = 'all';
let searchQuery = '';
let transactionSort = 'newest';
let editingTransactionId = null;
let selectedSpendingMonth = localDateISO().slice(0, 7);
const formatCurrency = amount => '₹' + Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatCompact = amount => '₹' + Number(amount).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const list = document.querySelector('#transaction-list');
const nameModal = document.querySelector('#name-modal');
const nameInput = document.querySelector('#user-name-input');
const nameError = document.querySelector('#name-error');
const goalModal = document.querySelector('#goal-modal');
const goalForm = document.querySelector('#goal-form');
const goalNameInput = document.querySelector('#goal-name-input');
const goalTargetInput = document.querySelector('#goal-target-input');
const goalError = document.querySelector('#goal-error');
const savingsModal = document.querySelector('#savings-modal');
const savingsForm = document.querySelector('#savings-form');
const savingsAmountInput = document.querySelector('#savings-amount-input');
const savingsError = document.querySelector('#savings-error');
let activeName = (localStorage.getItem('spendly-user-name') || '').trim();
const categoryIcons = { 'Food & drink': '☕', Shopping: '▤', Transport: '⌁', Housing: '⌂', Health: '＋', Salary: '↗', Entertainment: '▷', Other: '✦' };
const categoryTints = { 'Food & drink': 'tint-peach', Shopping: 'tint-purple', Transport: 'tint-blue', Housing: 'tint-sage', Health: 'tint-pink', Salary: 'tint-sage', Entertainment: 'tint-yellow', Other: 'tint-purple' };

function transactionAppearance(category) {
  return { icon: categoryIcons[category] || '✦', tint: categoryTints[category] || 'tint-purple' };
}

function sortTransactionItems(items) {
  const sorted = [...items];
  if (transactionSort === 'oldest') return sorted.sort((a, b) => a.dateISO.localeCompare(b.dateISO));
  if (transactionSort === 'highest') return sorted.sort((a, b) => Number(b.amount) - Number(a.amount));
  if (transactionSort === 'lowest') return sorted.sort((a, b) => Number(a.amount) - Number(b.amount));
  return sorted.sort((a, b) => b.dateISO.localeCompare(a.dateISO));
}

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

function renderGoalCard() {
  const list = document.querySelector('#goal-list');
  const emptyState = document.querySelector('#goal-empty');
  emptyState.hidden = savingsGoals.length > 0;
  list.innerHTML = savingsGoals.map(goal => {
    const saved = savingsContributionTotal(goal);
    const remaining = Math.max(0, goal.target - saved);
    const percentage = Math.min(100, Math.round(saved / goal.target * 100));
    const goalId = escapeHTML(goal.id);
    return `<section class="goal-entry"><h3>${escapeHTML(goal.name)}</h3><div class="goal-amount"><strong>${formatGoalAmount(saved)}</strong><span>of ${formatGoalAmount(goal.target)}</span></div><div class="progress-track" role="progressbar" aria-label="${escapeHTML(goal.name)} progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percentage}"><span style="width:${percentage}%"></span></div><div class="goal-foot"><span>${percentage}% completed</span><span>${formatGoalAmount(remaining)} to go</span></div><div class="goal-entry-actions"><button class="goal-action" type="button" data-goal-action="save" data-goal-id="${goalId}">＋ Add savings</button><button class="goal-action" type="button" data-goal-action="edit" data-goal-id="${goalId}">Edit</button><button class="goal-action goal-delete" type="button" data-goal-action="delete" data-goal-id="${goalId}" aria-label="Delete ${escapeHTML(goal.name)}">Delete</button></div></section>`;
  }).join('');
}

function openGoalModal(goalId = null) {
  const goal = savingsGoals.find(item => item.id === goalId);
  activeGoalId = goal?.id || null;
  const editing = Boolean(goal);
  document.querySelector('#goal-modal-title').textContent = editing ? 'Edit your savings goal' : 'Create a savings goal';
  document.querySelector('#goal-modal-kicker').textContent = editing ? 'UPDATE YOUR GOAL' : 'SAVINGS GOAL';
  goalForm.querySelector('button[type="submit"]').innerHTML = editing ? 'Save goal <span>→</span>' : 'Create goal <span>→</span>';
  document.querySelector('#close-goal-modal').hidden = false;
  goalNameInput.value = goal?.name || '';
  goalTargetInput.value = goal?.target || '';
  goalError.textContent = '';
  goalNameInput.setCustomValidity('');
  goalTargetInput.setCustomValidity('');
  goalModal.showModal();
  goalNameInput.focus();
}

renderGoalCard();

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

goalForm.addEventListener('submit', event => {
  event.preventDefault();
  const name = goalNameInput.value.trim();
  const target = Number(goalTargetInput.value);
  if (!name || !Number.isFinite(target) || target <= 0) {
    goalError.textContent = !name ? 'Enter a name for your goal.' : 'Enter a target amount greater than ₹0.';
    goalNameInput.setCustomValidity(name ? '' : 'Enter a name for your goal.');
    goalTargetInput.setCustomValidity(Number.isFinite(target) && target > 0 ? '' : 'Enter a target amount greater than ₹0.');
    (!name ? goalNameInput : goalTargetInput).reportValidity();
    (!name ? goalNameInput : goalTargetInput).focus();
    return;
  }

  const existingGoal = savingsGoals.find(goal => goal.id === activeGoalId);
  if (existingGoal) {
    existingGoal.name = name;
    existingGoal.target = target;
  } else {
    savingsGoals.push({ id: createGoalId(), name, target, contributions: [] });
  }
  saveSavingsGoals();
  renderGoalCard();
  activeGoalId = null;
  goalModal.close();
});

[goalNameInput, goalTargetInput].forEach(input => input.addEventListener('input', () => {
  input.setCustomValidity('');
  goalError.textContent = '';
}));

goalModal.addEventListener('cancel', event => {
  activeGoalId = null;
});

document.querySelector('#add-goal').addEventListener('click', () => openGoalModal());
document.querySelector('#add-first-goal').addEventListener('click', () => openGoalModal());
document.querySelector('#close-goal-modal').addEventListener('click', () => {
  activeGoalId = null;
  goalModal.close();
});
document.querySelector('#goal-list').addEventListener('click', event => {
  const button = event.target.closest('[data-goal-action]');
  if (!button) return;
  const goalId = button.dataset.goalId;
  const goal = savingsGoals.find(item => item.id === goalId);
  if (!goal) return;
  if (button.dataset.goalAction === 'edit') {
    openGoalModal(goalId);
    return;
  }
  if (button.dataset.goalAction === 'delete') {
    if (!window.confirm(`Delete the savings goal “${goal.name}” and its contributions? This cannot be undone.`)) return;
    savingsGoals = savingsGoals.filter(item => item.id !== goalId);
    saveSavingsGoals();
    renderGoalCard();
    return;
  }
  activeGoalId = goalId;
  savingsForm.reset();
  savingsAmountInput.setCustomValidity('');
  savingsError.textContent = '';
  document.querySelector('#savings-modal h2').textContent = `Add to ${goal.name}`;
  savingsModal.showModal();
  savingsAmountInput.focus();
});

savingsForm.addEventListener('submit', event => {
  event.preventDefault();
  const amount = Number(savingsAmountInput.value);
  if (!Number.isFinite(amount) || amount <= 0) {
    savingsError.textContent = 'Enter an amount greater than ₹0.';
    savingsAmountInput.setCustomValidity('Enter an amount greater than ₹0.');
    savingsAmountInput.reportValidity();
    savingsAmountInput.focus();
    return;
  }

  const goal = savingsGoals.find(item => item.id === activeGoalId);
  if (!goal) return;
  goal.contributions.push({ amount, dateISO: localDateISO() });
  saveSavingsGoals();
  renderGoalCard();
  savingsForm.reset();
  activeGoalId = null;
  savingsModal.close();
});

savingsAmountInput.addEventListener('input', () => {
  savingsAmountInput.setCustomValidity('');
  savingsError.textContent = '';
});

document.querySelector('#close-savings-modal').addEventListener('click', () => {
  activeGoalId = null;
  savingsModal.close();
});
savingsModal.addEventListener('cancel', () => { activeGoalId = null; });

function renderTransactions() {
  const query = searchQuery.trim().toLowerCase();
  const visible = transactions.filter(item => {
    const matchesFilter = transactionFilter === 'all' || item.type === transactionFilter;
    const matchesSearch = !query || item.title.toLowerCase().includes(query) || item.category.toLowerCase().includes(query);
    return matchesFilter && matchesSearch;
  });
  const sortedVisible = sortTransactionItems(visible);
  const shown = showAll ? sortedVisible : sortedVisible.slice(0, 6);
  list.innerHTML = shown.length ? shown.map(item => `
    <div class="transaction-row">
      <div class="transaction-main"><span class="transaction-icon ${escapeHTML(item.tint)}">${escapeHTML(item.icon)}</span><div><div class="transaction-name">${escapeHTML(item.title)}</div><div class="transaction-sub">${item.type === 'income' ? 'Money in' : 'Money out'}</div></div></div>
      <span class="category-chip">${escapeHTML(item.category)}</span><span class="transaction-date">${escapeHTML(item.date)}</span>
      <span class="transaction-amount ${item.type}">${item.type === 'income' ? '+' : '−'}${formatCurrency(item.amount)}</span>
      <span class="transaction-actions"><button class="transaction-edit" type="button" data-edit-id="${escapeHTML(item.id)}" aria-label="Edit ${escapeHTML(item.title)}" title="Edit transaction">Edit</button><button class="transaction-delete" type="button" data-delete-id="${escapeHTML(item.id)}" aria-label="Delete ${escapeHTML(item.title)}" title="Delete transaction"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg></button></span>
    </div>`).join('') : `<div class="empty-state">${transactions.length === 0 ? 'No transactions yet. Add your first transaction to get started.' : 'No transactions match your current search or filter.'}</div>`;
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
  updateSpendingPanel();
}

function updateSpendingPanel() {
  const currentMonth = localDateISO().slice(0, 7);
  const availableMonths = new Set(transactions.map(transactionMonth));
  if (availableMonths.size === 0) availableMonths.add(currentMonth);
  const months = [...availableMonths].sort((first, second) => second.localeCompare(first));
  if (!months.includes(selectedSpendingMonth)) selectedSpendingMonth = months[0];

  const monthLabelText = selectedSpendingMonth === currentMonth ? 'This month' : monthLabel(selectedSpendingMonth);
  document.querySelector('#selected-spending-month').textContent = monthLabelText;
  document.querySelector('#chart-period-caption').textContent = selectedSpendingMonth === currentMonth
    ? 'Spent this month'
    : `Spent in ${monthLabel(selectedSpendingMonth)}`;

  const monthMenu = document.querySelector('#spending-month-menu');
  monthMenu.innerHTML = months.map(month => {
    const isSelected = month === selectedSpendingMonth;
    const label = month === currentMonth ? 'This month' : monthLabel(month);
    return `<button class="period-option${isSelected ? ' is-selected' : ''}" type="button" role="menuitemradio" data-month="${month}" aria-checked="${isSelected}">${label}</button>`;
  }).join('');

  const monthlyExpenses = transactions.filter(item => item.type === 'expense'
    && transactionMonth(item) === selectedSpendingMonth);
  const expense = monthlyExpenses.reduce((sum, item) => sum + Number(item.amount), 0);
  const categoryTotals = new Map();
  monthlyExpenses.forEach(item => categoryTotals.set(item.category, (categoryTotals.get(item.category) || 0) + Number(item.amount)));
  const categories = [...categoryTotals.entries()].sort((first, second) => second[1] - first[1]);
  const donut = document.querySelector('.donut-chart');
  donut.classList.toggle('is-empty', expense === 0);
  const legend = document.querySelector('#chart-legend');
  if (expense > 0) {
    let accumulated = 0;
    const segments = categories.map(([category, amount], index) => {
      const start = accumulated;
      accumulated += amount / expense * 360;
      const end = index === categories.length - 1 ? 360 : accumulated;
      return `${chartColors[index % chartColors.length]} ${start}deg ${end}deg`;
    });
    donut.style.background = `conic-gradient(${segments.join(', ')})`;
    legend.innerHTML = categories.map(([category, amount], index) => `<div><span class="legend-dot" style="background:${chartColors[index % chartColors.length]}"></span><span>${escapeHTML(category)}</span><strong>${formatGoalAmount(amount)}</strong></div>`).join('');
  } else {
    donut.style.background = '';
    legend.innerHTML = '<p class="chart-empty">No spending data yet.</p>';
  }
  document.querySelector('#chart-total').textContent = formatGoalAmount(expense);
  const periodText = selectedSpendingMonth === currentMonth
    ? 'this month'
    : `in ${monthLabel(selectedSpendingMonth)}`;
  document.querySelector('#spending-tip-text').textContent = expense
    ? `${monthlyExpenses.length} expense transaction${monthlyExpenses.length === 1 ? '' : 's'} recorded ${periodText}.`
    : `No expenses recorded ${periodText} yet.`;
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

renderTransactions();

const modal = document.querySelector('#transaction-modal');
const transactionDateInput = document.querySelector('#transaction-date');
document.querySelector('#open-modal').addEventListener('click', () => {
  editingTransactionId = null;
  document.querySelector('#transaction-modal-kicker').textContent = 'NEW ENTRY';
  document.querySelector('#transaction-modal-title').textContent = 'Add a transaction';
  document.querySelector('#transaction-submit').innerHTML = 'Add transaction <span>→</span>';
  document.querySelector('#transaction-form').reset();
  transactionDateInput.value = localDateISO();
  modal.showModal();
});
document.querySelector('#close-modal').addEventListener('click', () => {
  editingTransactionId = null;
  modal.close();
});
document.querySelector('#transaction-form').addEventListener('submit', event => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const type = form.get('type');
  const dateISO = form.get('date');
  const category = form.get('category');
  const existing = transactions.find(item => item.id === editingTransactionId);
  const updatedTransaction = { ...(existing || {}), id: existing?.id || createTransactionId(), title: form.get('title').trim(), category, date: formatTransactionDate(dateISO), dateISO, amount: Number(form.get('amount')), type, ...transactionAppearance(category) };
  if (existing) transactions = transactions.map(item => item.id === existing.id ? updatedTransaction : item);
  else transactions.unshift(updatedTransaction);
  saveTransactions(transactions);
  editingTransactionId = null;
  renderTransactions();
  event.currentTarget.reset();
  modal.close();
});
list.addEventListener('click', event => {
  const editButton = event.target.closest('[data-edit-id]');
  if (editButton) {
    const item = transactions.find(transaction => transaction.id === editButton.dataset.editId);
    if (!item) return;
    editingTransactionId = item.id;
    document.querySelector('#transaction-modal-kicker').textContent = 'EDIT ENTRY';
    document.querySelector('#transaction-modal-title').textContent = 'Edit transaction';
    document.querySelector('#transaction-submit').innerHTML = 'Save changes <span>→</span>';
    document.querySelector('#transaction-title').value = item.title;
    document.querySelector('#transaction-amount').value = item.amount;
    document.querySelector('#transaction-type').value = item.type;
    const categorySelect = document.querySelector('#transaction-category');
    if (![...categorySelect.options].some(option => option.value === item.category)) categorySelect.add(new Option(item.category, item.category));
    categorySelect.value = item.category;
    transactionDateInput.value = item.dateISO;
    modal.showModal();
    document.querySelector('#transaction-title').focus();
    return;
  }
  const deleteButton = event.target.closest('[data-delete-id]');
  if (!deleteButton) return;
  const item = transactions.find(transaction => transaction.id === deleteButton.dataset.deleteId);
  if (!item || !window.confirm(`Delete the transaction “${item.title}”? This cannot be undone.`)) return;
  transactions = transactions.filter(item => item.id !== deleteButton.dataset.deleteId);
  saveTransactions(transactions);
  renderTransactions();
});
document.querySelector('#show-more').addEventListener('click', () => { showAll = !showAll; renderTransactions(); });
document.querySelector('#transaction-sort').addEventListener('change', event => {
  transactionSort = event.currentTarget.value;
  showAll = false;
  renderTransactions();
});
document.querySelector('#export-csv').addEventListener('click', () => {
  const rows = [['Date', 'Title', 'Amount', 'Type', 'Category'], ...sortTransactionItems(transactions).map(item => [item.dateISO, item.title, item.amount, item.type, item.category])];
  downloadFile(`spendly-transactions-${localDateISO()}.csv`, `\uFEFF${rows.map(row => row.map(csvCell).join(',')).join('\r\n')}`, 'text/csv;charset=utf-8');
  document.querySelector('#data-status').textContent = 'CSV exported.';
});
document.querySelector('#export-backup').addEventListener('click', () => {
  const backup = {
    app: 'Spendly',
    version: 1,
    exportedAt: new Date().toISOString(),
    userName: localStorage.getItem('spendly-user-name') || '',
    transactions,
    savingsGoals
  };
  downloadFile(`spendly-backup-${localDateISO()}.json`, JSON.stringify(backup, null, 2), 'application/json');
  document.querySelector('#data-status').textContent = 'Backup exported.';
});
document.querySelector('#import-backup-file').addEventListener('change', async event => {
  const input = event.currentTarget;
  const file = input.files?.[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    const backup = validateBackup(parsed);
    if (!window.confirm(`Import ${backup.transactions.length} transactions and ${backup.savingsGoals.length} savings goals? This will replace your current Spendly data.`)) return;
    localStorage.setItem(transactionStorageKey, JSON.stringify(backup.transactions));
    localStorage.setItem(savingsGoalsStorageKey, JSON.stringify(backup.savingsGoals));
    localStorage.removeItem(legacySavingsGoalStorageKey);
    if (backup.userName) localStorage.setItem('spendly-user-name', backup.userName);
    else localStorage.removeItem('spendly-user-name');
    transactions = backup.transactions;
    savingsGoals = backup.savingsGoals;
    activeName = backup.userName;
    if (activeName) displayName(activeName);
    else {
      document.querySelector('#greeting-name').textContent = 'there';
      document.querySelector('#profile-name').textContent = 'Your account';
      document.querySelector('#profile-initials').textContent = 'A';
      document.querySelector('#top-initial').textContent = 'A';
    }
    selectedSpendingMonth = localDateISO().slice(0, 7);
    showAll = false;
    renderGoalCard();
    renderTransactions();
    document.querySelector('#data-status').textContent = 'Spendly backup imported successfully.';
  } catch (error) {
    document.querySelector('#data-status').textContent = `Could not import backup: ${error.message || 'The file is invalid.'}`;
  } finally {
    input.value = '';
  }
});
const monthPicker = document.querySelector('#spending-month-picker');
const monthToggle = document.querySelector('#spending-month-toggle');
const monthMenu = document.querySelector('#spending-month-menu');

monthToggle.addEventListener('click', () => {
  const isOpen = !monthMenu.hidden;
  monthMenu.hidden = isOpen;
  monthToggle.setAttribute('aria-expanded', String(!isOpen));
});

monthMenu.addEventListener('click', event => {
  const option = event.target.closest('[data-month]');
  if (!option) return;
  selectedSpendingMonth = option.dataset.month;
  monthMenu.hidden = true;
  monthToggle.setAttribute('aria-expanded', 'false');
  updateSpendingPanel();
});

document.addEventListener('click', event => {
  if (!monthMenu.hidden && !monthPicker.contains(event.target)) {
    monthMenu.hidden = true;
    monthToggle.setAttribute('aria-expanded', 'false');
  }
});

monthPicker.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !monthMenu.hidden) {
    monthMenu.hidden = true;
    monthToggle.setAttribute('aria-expanded', 'false');
    monthToggle.focus();
  }
});

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
