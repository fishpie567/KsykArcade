import { state } from './state.js';

function renderHome() {
  return `
    <section class="card hero">
      <h1>Level up your digital arcade</h1>
      <p>Buy Euros with PayPal, explore community games, and keep track of your virtual wallet in one place.</p>
      <div class="hero-actions">
        <button class="accent" data-action="open-auth" data-auth="register">Create account</button>
        <button class="ghost" data-action="open-auth" data-auth="login">Sign in</button>
      </div>
    </section>
    <section class="card-grid" style="margin-top:2rem;">
      <article class="card">
        <h2>PayPal ready</h2>
        <p>Securely load Euros into your account using your existing PayPal balance in just a few clicks.</p>
      </article>
      <article class="card">
        <h2>Connected profiles</h2>
        <p>Register with email or sign in using Google. Email verification keeps accounts safe.</p>
      </article>
      <article class="card">
        <h2>Arcade foundation</h2>
        <p>Dive into the Euro Arcade hub—more mini games are on the way and you can plug in your own.</p>
      </article>
    </section>
  `;
}

function renderDashboard({ balance, transactions }) {
  const euros = Number(balance || 0).toFixed(2);
  const txRows = (transactions || [])
    .map(
      (tx) => `
        <tr>
          <td>${tx.createdAt ? new Date(tx.createdAt).toLocaleString() : ''}</td>
          <td>${tx.euros?.toFixed ? tx.euros.toFixed(2) : tx.euros}</td>
          <td>${tx.amountPaid?.toFixed ? tx.amountPaid.toFixed(2) : tx.amountPaid} ${tx.currency || ''}</td>
          <td>${tx.status || ''}</td>
        </tr>
      `
    )
    .join('');
  return `
    <div class="card-grid">
      <section class="card">
        <h2>Your wallet</h2>
        <p>Current balance</p>
        <div class="hero-actions" style="justify-content:flex-start;">
          <div class="stat-card" style="min-width:200px;">
            <span>Euros available</span>
            <strong>€${euros}</strong>
          </div>
          <div>
            <label for="euro-amount">Select amount</label>
            <select id="euro-amount">
              <option value="5">5 €</option>
              <option value="10">10 €</option>
              <option value="20">20 €</option>
              <option value="50">50 €</option>
            </select>
            <div class="paypal-container">
              <div id="paypal-button-container"></div>
              <div id="paypal-status" class="alert" hidden></div>
            </div>
          </div>
        </div>
      </section>
      <section class="card">
        <h2>Purchase history</h2>
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Euros</th>
                <th>Paid</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>${txRows || '<tr><td colspan="4">No purchases yet</td></tr>'}</tbody>
          </table>
        </div>
      </section>
    </div>
  `;
}

function renderArcade(gamesHtml) {
  return `
    <div class="card-grid">
      <section class="card">
        <h2>Playground</h2>
        <p>Welcome to the Euro Arcade hub! Start with Euro Clicker and get ready for more community games.</p>
        <canvas id="clicker-canvas"></canvas>
        <div class="hero-actions" style="justify-content:center;">
          <button class="accent" data-action="start-clicker">Start Euro Clicker</button>
        </div>
      </section>
      <section class="card">
        <h2>Game library</h2>
        <div class="games-grid">
          ${gamesHtml}
        </div>
      </section>
    </div>
  `;
}

function renderGameCard(game) {
  return `
    <article class="game-card">
      <h3>${game.name}</h3>
      <p>${game.description}</p>
      <div class="hero-actions" style="justify-content:flex-start;">
        <span class="badge">${(game.tags || []).join(', ')}</span>
      </div>
    </article>
  `;
}

function renderAdmin(usersHtml) {
  return `
    <section class="card">
      <h2>Admin coin controls</h2>
      <p>Search for a user and adjust their Euro balance.</p>
      <div id="admin-users">${usersHtml}</div>
    </section>
  `;
}

function renderVerify(token, statusMessage) {
  if (!token) {
    return `
      <section class="card">
        <h2>Verification link invalid</h2>
        <p>The token is missing. Please use the link from your email.</p>
      </section>
    `;
  }
  return `
    <section class="card">
      <h2>Email verification</h2>
      <p>${statusMessage || 'Verifying your account...'}</p>
    </section>
  `;
}

export { renderHome, renderDashboard, renderArcade, renderGameCard, renderAdmin, renderVerify };
