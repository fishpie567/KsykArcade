import { API } from './api.js';
import { state, setUser, setConfig, subscribe } from './state.js';
import { renderHome, renderDashboard, renderArcade, renderGameCard, renderVerify } from './ui.js';
import { openAuthModal } from './authModal.js';
import { startClicker, stopClicker } from './clicker.js';
import { mountAdminView } from './admin.js';

const viewContainer = document.getElementById('view-container');
const userGreeting = document.getElementById('user-greeting');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const yearEl = document.getElementById('year');
const navButtons = Array.from(document.querySelectorAll('.nav-btn'));

yearEl.textContent = new Date().getFullYear();

let currentView = 'home';
let paypalScriptPromise = null;

const unsubscribe = subscribe(updateNav);
updateNav();
loginBtn.addEventListener('click', () => openAuthModal(state.user ? 'login' : 'login'));
logoutBtn.addEventListener('click', async () => {
  try {
    await API.logout();
    setUser(null);
    renderView('home');
  } catch (error) {
    alert(error.message);
  }
});

navButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const view = btn.dataset.view;
    renderView(view);
  });
});

document.addEventListener('click', (event) => {
  const { action, auth } = event.target.dataset || {};
  if (action === 'open-auth') {
    event.preventDefault();
    openAuthModal(auth || 'login');
  }
  if (action === 'start-clicker') {
    const canvas = document.getElementById('clicker-canvas');
    startClicker(canvas);
  }
});

init();

async function init() {
  await loadConfig();
  await fetchSession();
  renderView('home');
}

async function loadConfig() {
  try {
    const config = await API.getConfig();
    setConfig(config);
  } catch (error) {
    console.warn('Failed to load config', error);
  }
}

async function fetchSession() {
  try {
    const data = await API.me();
    setUser(data.user);
  } catch (error) {
    setUser(null);
  }
}

function updateNav() {
  if (state.user) {
    userGreeting.textContent = `Hi, ${state.user.displayName || state.user.email}`;
    loginBtn.style.display = 'none';
    logoutBtn.style.display = 'inline-flex';
  } else {
    userGreeting.textContent = '';
    loginBtn.style.display = 'inline-flex';
    logoutBtn.style.display = 'none';
  }
  navButtons.forEach((btn) => {
    const requiresAuth = ['dashboard', 'arcade', 'admin'].includes(btn.dataset.view);
    btn.disabled = requiresAuth && !state.user;
    btn.classList.toggle('active', btn.dataset.view === currentView);
  });
}

async function renderView(view) {
  currentView = view;
  updateNav();
  stopClicker(document.getElementById('clicker-canvas'));

  switch (view) {
    case 'dashboard':
      await showDashboard();
      break;
    case 'arcade':
      await showArcade();
      break;
    case 'admin':
      await showAdmin();
      break;
    default:
      viewContainer.innerHTML = renderHome();
  }
}

async function showDashboard() {
  if (!state.user) {
    viewContainer.innerHTML = guestMessage('Sign in to access your wallet.');
    return;
  }
  try {
    const [balance, transactions] = await Promise.all([
      API.getBalance(),
      API.getTransactions(),
    ]);
    viewContainer.innerHTML = renderDashboard({
      balance: balance.balance,
      transactions: transactions.transactions,
    });
    await setupPayPal();
  } catch (error) {
    viewContainer.innerHTML = guestMessage(error.message);
  }
}

async function showArcade() {
  if (!state.user) {
    viewContainer.innerHTML = guestMessage('Create an account to access the arcade.');
    return;
  }
  try {
    const { games } = await API.listGames();
    const cards = games.map((game) => renderGameCard(game)).join('');
    viewContainer.innerHTML = renderArcade(cards);
  } catch (error) {
    viewContainer.innerHTML = guestMessage(error.message);
  }
}

async function showAdmin() {
  if (!state.user) {
    viewContainer.innerHTML = guestMessage('You must be logged in.');
    return;
  }
  if (state.user.role !== 'admin') {
    viewContainer.innerHTML = guestMessage('Admin access required.');
    return;
  }
  mountAdminView(viewContainer);
}

function guestMessage(message) {
  return `
    <section class="card">
      <h2>Hold up!</h2>
      <p>${message}</p>
      <div class="hero-actions">
        <button class="accent" data-action="open-auth" data-auth="login">Sign in</button>
        <button class="ghost" data-action="open-auth" data-auth="register">Register</button>
      </div>
    </section>
  `;
}

async function setupPayPal() {
  if (!state.config?.paypalClientId) {
    const status = document.getElementById('paypal-status');
    status.hidden = false;
    status.className = 'alert error';
    status.textContent = 'PayPal is not configured. Add credentials in the .env file.';
    return;
  }
  await ensurePayPalScript();
  const select = document.getElementById('euro-amount');
  const status = document.getElementById('paypal-status');
  const container = document.getElementById('paypal-button-container');
  container.innerHTML = '';
  status.hidden = true;

  window.paypal.Buttons({
    style: { layout: 'vertical', shape: 'pill', color: 'blue' },
    createOrder: async () => {
      try {
        const euros = Number(select.value || 0);
        const order = await API.createOrder(euros);
        return order.id;
      } catch (error) {
        status.hidden = false;
        status.className = 'alert error';
        status.textContent = error.message;
        throw error;
      }
    },
    onApprove: async (data) => {
      try {
        const result = await API.captureOrder(data.orderID);
        status.hidden = false;
        status.className = 'alert success';
        status.textContent = `Purchase complete! New balance: €${Number(result.balance).toFixed(2)}`;
        await showDashboard();
      } catch (error) {
        status.hidden = false;
        status.className = 'alert error';
        status.textContent = error.message;
      }
    },
    onError: (err) => {
      status.hidden = false;
      status.className = 'alert error';
      status.textContent = err?.message || 'PayPal checkout failed.';
    },
  }).render(container);
}

function ensurePayPalScript() {
  if (window.paypal) return Promise.resolve();
  if (!paypalScriptPromise) {
    paypalScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      const params = new URLSearchParams({
        'client-id': state.config.paypalClientId,
        currency: state.config.currency || 'USD',
      });
      script.src = `https://www.paypal.com/sdk/js?${params.toString()}`;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load PayPal SDK'));
      document.head.appendChild(script);
    });
  }
  return paypalScriptPromise;
}

window.addEventListener('beforeunload', () => {
  unsubscribe();
});
