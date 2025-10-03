const API_BASE = '';
let authToken = localStorage.getItem('euros_token') || '';
let currentUser = null;
let paypalButtons = null;

const registerForm = document.getElementById('register-form');
const loginForm = document.getElementById('login-form');
const registerStatus = document.getElementById('register-status');
const loginStatus = document.getElementById('login-status');
const accountInfo = document.getElementById('account-info');
const accountName = document.getElementById('account-name');
const accountEmail = document.getElementById('account-email');
const accountBalance = document.getElementById('account-balance');
const accountStatus = document.getElementById('account-status');
const logoutBtn = document.getElementById('logout-btn');
const paypalStatus = document.getElementById('paypal-status');
const transactionsCard = document.getElementById('transactions');
const transactionsBody = document.getElementById('transactions-body');
const adminPanel = document.getElementById('admin-panel');
const adminUsersBody = document.getElementById('admin-users');
const adminStatus = document.getElementById('admin-status');
const resendVerificationBtn = document.getElementById('resend-verification');
const purchaseAmountInput = document.getElementById('purchase-amount');

async function apiRequest(path, options = {}) {
  const headers = options.headers || {};
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });
  if (response.status === 204) {
    return null;
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(data?.error || 'Request failed');
    error.details = data?.details;
    throw error;
  }
  return data;
}

function setStatus(element, message, tone = 'neutral') {
  element.textContent = message || '';
  element.dataset.tone = tone;
}

function saveToken(token) {
  authToken = token;
  if (token) {
    localStorage.setItem('euros_token', token);
  } else {
    localStorage.removeItem('euros_token');
  }
}

function updateAccountUi() {
  if (currentUser) {
    accountName.textContent = currentUser.displayName || 'Player';
    accountEmail.textContent = currentUser.email || 'Linked with Google';
    accountBalance.textContent = Number(currentUser.balanceEuros || 0).toFixed(2);
    accountStatus.textContent = currentUser.verified ? 'Verified' : 'Awaiting verification';
    accountInfo.hidden = false;
    logoutBtn.hidden = false;
    if (currentUser.verified) {
      setStatus(paypalStatus, '');
      transactionsCard.hidden = false;
    } else {
      setStatus(paypalStatus, 'Verify your email to purchase Euros.');
      transactionsCard.hidden = true;
    }
  } else {
    accountInfo.hidden = true;
    logoutBtn.hidden = true;
    transactionsCard.hidden = true;
  }
  configureAdminUi();
  renderPayPalButtons();
  loadTransactions();
}

async function loadTransactions() {
  if (!currentUser) {
    transactionsBody.innerHTML = '';
    return;
  }
  try {
    const { transactions } = await apiRequest('/api/transactions', { method: 'GET' });
    if (!transactions || transactions.length === 0) {
      transactionsBody.innerHTML = '<tr><td colspan="3">No transactions yet.</td></tr>';
      return;
    }
    transactionsBody.innerHTML = transactions
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map(
        (tx) => `
          <tr>
            <td>${new Date(tx.createdAt).toLocaleString()}</td>
            <td>${tx.orderId}</td>
            <td>${Number(tx.amount).toFixed(2)} €</td>
          </tr>
        `,
      )
      .join('');
  } catch (err) {
    console.warn(err);
  }
}

async function configureAdminUi() {
  if (!currentUser?.isAdmin) {
    adminPanel.hidden = true;
    adminStatus.textContent = 'Admin access is restricted.';
    return;
  }
  try {
    const { users } = await apiRequest('/api/admin/users', { method: 'GET' });
    adminPanel.hidden = false;
    adminStatus.textContent = '';
    adminUsersBody.innerHTML = users
      .map(
        (user) => `
          <tr data-user-id="${user.id}">
            <td>${user.displayName || 'Player'}</td>
            <td>${user.email || 'Google linked'}</td>
            <td>
              <input type="number" class="balance-input" value="${Number(user.balanceEuros || 0).toFixed(2)}" step="0.01" />
            </td>
            <td>${user.verified ? 'Yes' : 'No'}</td>
            <td>
              <button class="ghost apply-balance">Apply</button>
            </td>
          </tr>
        `,
      )
      .join('');
  } catch (err) {
    adminPanel.hidden = true;
    setStatus(adminStatus, err.message || 'Failed to load users', 'error');
  }
}

registerForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(registerForm);
  const email = formData.get('email');
  const password = formData.get('password');
  const displayName = formData.get('displayName');
  try {
    setStatus(registerStatus, 'Creating account...');
    await apiRequest('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, displayName }),
    });
    setStatus(registerStatus, 'Account created! Check your inbox to verify your email.', 'success');
    registerForm.reset();
  } catch (err) {
    setStatus(registerStatus, err.message, 'error');
  }
});

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(loginForm);
  const email = formData.get('email');
  const password = formData.get('password');
  try {
    setStatus(loginStatus, 'Signing in...');
    const { token, user } = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    saveToken(token);
    currentUser = user;
    setStatus(loginStatus, 'Logged in successfully!', 'success');
    updateAccountUi();
  } catch (err) {
    setStatus(loginStatus, err.message, 'error');
  }
});

logoutBtn.addEventListener('click', () => {
  saveToken('');
  currentUser = null;
  updateAccountUi();
});

resendVerificationBtn.addEventListener('click', async () => {
  const email = registerForm.querySelector('input[name="email"]').value;
  if (!email) {
    setStatus(registerStatus, 'Enter your email above first.', 'error');
    return;
  }
  try {
    setStatus(registerStatus, 'Resending verification email...');
    await apiRequest('/api/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
    setStatus(registerStatus, 'Verification email sent!', 'success');
  } catch (err) {
    setStatus(registerStatus, err.message, 'error');
  }
});

adminUsersBody.addEventListener('click', async (event) => {
  if (!event.target.classList.contains('apply-balance')) return;
  const row = event.target.closest('tr[data-user-id]');
  const userId = row.dataset.userId;
  const balanceInput = row.querySelector('.balance-input');
  const balanceEuros = Number.parseFloat(balanceInput.value);
  if (!Number.isFinite(balanceEuros)) {
    setStatus(adminStatus, 'Enter a valid amount.', 'error');
    return;
  }
  try {
    setStatus(adminStatus, 'Saving...');
    await apiRequest(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ balanceEuros }),
    });
    setStatus(adminStatus, 'Balance updated.', 'success');
    await bootstrap();
  } catch (err) {
    setStatus(adminStatus, err.message, 'error');
  }
});

function renderPayPalButtons() {
  const container = document.getElementById('paypal-button-container');
  if (!window.paypal || !container) {
    return;
  }
  container.innerHTML = '';
  if (!currentUser) {
    setStatus(paypalStatus, 'Log in to buy Euros.', 'error');
    return;
  }
  if (!currentUser.verified) {
    setStatus(paypalStatus, 'Verify your email to continue.', 'error');
    return;
  }
  if (paypalButtons) {
    paypalButtons.close();
  }
  paypalButtons = window.paypal.Buttons({
    style: {
      shape: 'pill',
      color: 'blue',
      layout: 'vertical',
      label: 'paypal',
    },
    createOrder: async () => {
      const amount = Number.parseFloat(purchaseAmountInput.value || '0');
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error('Enter a valid amount');
      }
      const order = await apiRequest('/api/paypal/create-order', {
        method: 'POST',
        body: JSON.stringify({ amount }),
      });
      return order.id;
    },
    onApprove: async (data) => {
      try {
        setStatus(paypalStatus, 'Capturing payment...');
        const result = await apiRequest('/api/paypal/capture-order', {
          method: 'POST',
          body: JSON.stringify({ orderId: data.orderID }),
        });
        currentUser = result.user;
        setStatus(paypalStatus, `Payment successful! Added ${result.amount.toFixed(2)} € to your balance.`, 'success');
        updateAccountUi();
      } catch (err) {
        setStatus(paypalStatus, err.message, 'error');
      }
    },
    onError: (err) => {
      console.error(err);
      setStatus(paypalStatus, 'PayPal error. Try again.', 'error');
    },
  });
  paypalButtons.render(container);
}

function initializeGoogleSignIn() {
  if (!window.google || !document.getElementById('google-signin')) {
    return;
  }
  const clientId = document.querySelector('meta[name="google-signin-client_id"]')?.content || window.GOOGLE_CLIENT_ID;
  if (!clientId) {
    document.getElementById('google-signin').textContent = 'Configure Google sign-in in app.js to enable one-click login.';
    return;
  }
  window.google.accounts.id.initialize({
    client_id: clientId,
    callback: async ({ credential }) => {
      try {
        setStatus(loginStatus, 'Signing in with Google...');
        const { token, user } = await apiRequest('/api/auth/google', {
          method: 'POST',
          body: JSON.stringify({ credential }),
        });
        saveToken(token);
        currentUser = user;
        setStatus(loginStatus, 'Logged in with Google!', 'success');
        updateAccountUi();
      } catch (err) {
        setStatus(loginStatus, err.message, 'error');
      }
    },
  });
  window.google.accounts.id.renderButton(document.getElementById('google-signin'), {
    type: 'standard',
    theme: 'outline',
    size: 'large',
  });
}

async function bootstrap() {
  if (authToken) {
    try {
      const { user } = await apiRequest('/api/user', { method: 'GET' });
      currentUser = user;
    } catch (err) {
      console.warn('Failed to restore session', err);
      saveToken('');
    }
  }
  updateAccountUi();
}

window.addEventListener('load', () => {
  bootstrap();
  initializeGoogleSignIn();
});

// --------------------------
// Mini games implementation
// --------------------------

const gameArea = document.getElementById('game-area');
const gameTitle = document.getElementById('game-title');
const closeGameBtn = document.getElementById('close-game');
const coinClickerCanvas = document.getElementById('coin-clicker-canvas');
const memoryBoard = document.getElementById('memory-match-board');
const gameStatus = document.getElementById('game-status');
let activeGame = null;
let gameLoopId = null;
let remainingTime = 0;
let score = 0;

function openGameArea(name) {
  gameArea.hidden = false;
  gameTitle.textContent = name;
  gameStatus.textContent = '';
}

function closeGameArea() {
  gameArea.hidden = true;
  coinClickerCanvas.hidden = true;
  memoryBoard.hidden = true;
  gameStatus.textContent = '';
  activeGame = null;
  cancelAnimationFrame(gameLoopId);
}

closeGameBtn.addEventListener('click', closeGameArea);

document.querySelectorAll('.start-game').forEach((button) => {
  button.addEventListener('click', (event) => {
    const game = event.currentTarget.dataset.game;
    if (game === 'coin-clicker') {
      startCoinClicker();
    } else if (game === 'memory-match') {
      startMemoryMatch();
    }
  });
});

// Coin Clicker Game
function startCoinClicker() {
  const ctx = coinClickerCanvas.getContext('2d');
  const coins = [];
  score = 0;
  remainingTime = 30;
  activeGame = 'coin-clicker';
  coinClickerCanvas.hidden = false;
  memoryBoard.hidden = true;
  openGameArea('Coin Clicker');

  function spawnCoin() {
    const radius = 24;
    coins.push({
      x: Math.random() * (coinClickerCanvas.width - radius * 2) + radius,
      y: Math.random() * (coinClickerCanvas.height - radius * 2) + radius,
      radius,
      value: 1,
      ttl: 120 + Math.random() * 60,
    });
  }

  function tick() {
    ctx.clearRect(0, 0, coinClickerCanvas.width, coinClickerCanvas.height);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
    ctx.fillRect(0, 0, coinClickerCanvas.width, coinClickerCanvas.height);

    if (Math.random() < 0.05) {
      spawnCoin();
    }

    coins.forEach((coin) => {
      coin.ttl -= 1;
      ctx.beginPath();
      ctx.arc(coin.x, coin.y, coin.radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(250, 204, 21, 0.85)';
      ctx.fill();
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('€', coin.x, coin.y);
    });

    for (let i = coins.length - 1; i >= 0; i -= 1) {
      if (coins[i].ttl <= 0) {
        coins.splice(i, 1);
      }
    }

    gameStatus.textContent = `Score: ${score} | Time left: ${remainingTime.toFixed(1)}s`;

    remainingTime -= 1 / 60;
    if (remainingTime <= 0) {
      gameStatus.textContent = `Time's up! You collected ${score} coins.`;
      cancelAnimationFrame(gameLoopId);
      return;
    }

    gameLoopId = requestAnimationFrame(tick);
  }

  coinClickerCanvas.onclick = (event) => {
    const rect = coinClickerCanvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    for (let i = coins.length - 1; i >= 0; i -= 1) {
      const coin = coins[i];
      const distance = Math.hypot(coin.x - x, coin.y - y);
      if (distance <= coin.radius) {
        coins.splice(i, 1);
        score += coin.value;
        break;
      }
    }
  };

  tick();
}

// Memory Match Game
function startMemoryMatch() {
  activeGame = 'memory-match';
  memoryBoard.hidden = false;
  coinClickerCanvas.hidden = true;
  openGameArea('Memory Match');
  memoryBoard.innerHTML = '';
  gameStatus.textContent = 'Find all matching pairs in as few moves as possible.';

  const symbols = ['€', '★', '♥', '☂', '⚡', '♫', '☕', '⚽'];
  const deck = [...symbols, ...symbols]
    .map((symbol) => ({ id: crypto.randomUUID(), symbol }))
    .sort(() => Math.random() - 0.5);

  let revealed = [];
  let moves = 0;
  let matched = 0;

  deck.forEach((card) => {
    const el = document.createElement('button');
    el.className = 'memory-card';
    el.type = 'button';
    el.dataset.cardId = card.id;
    el.textContent = '';
    el.addEventListener('click', () => {
      if (el.classList.contains('revealed') || revealed.length === 2) {
        return;
      }
      el.classList.add('revealed');
      el.textContent = card.symbol;
      revealed.push({ card, el });
      if (revealed.length === 2) {
        moves += 1;
        if (revealed[0].card.symbol === revealed[1].card.symbol) {
          matched += 1;
          revealed = [];
          if (matched === symbols.length) {
            gameStatus.textContent = `You matched everything in ${moves} moves!`;
          }
        } else {
          setTimeout(() => {
            revealed.forEach((item) => {
              item.el.classList.remove('revealed');
              item.el.textContent = '';
            });
            revealed = [];
          }, 900);
        }
      }
    });
    memoryBoard.appendChild(el);
  });
}
