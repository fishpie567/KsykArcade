import { API } from './api.js';

function mountAdminView(container) {
  container.innerHTML = getTemplate();
  const searchForm = container.querySelector('#admin-search');
  const updateForm = container.querySelector('#admin-update');
  const statusEl = container.querySelector('#admin-status');
  const details = container.querySelector('#admin-details');

  searchForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = Object.fromEntries(new FormData(searchForm).entries());
    if (!formData.email && !formData.userId) {
      show('Please provide an email or user ID.', 'error');
      return;
    }
    try {
      show('Searching...', 'info');
      const { user } = await API.findUser(formData);
      details.innerHTML = renderDetails(user);
      show('User loaded. You can update the balance below.', 'success');
      updateForm.elements.userId.value = user.id;
      updateForm.elements.balance.value = user.euros ?? 0;
    } catch (error) {
      details.innerHTML = '';
      show(error.message, 'error');
    }
  });

  updateForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(updateForm).entries());
    if (!payload.userId) {
      show('Load a user first.', 'error');
      return;
    }
    try {
      show('Updating...', 'info');
      await API.updateCoins({ userId: payload.userId, balance: Number(payload.balance) });
      show('Balance updated successfully.', 'success');
    } catch (error) {
      show(error.message, 'error');
    }
  });

  function show(message, type) {
    statusEl.textContent = message;
    statusEl.className = `alert ${type}`;
    statusEl.hidden = false;
  }
}

function renderDetails(user) {
  return `
    <div class="card" style="background:rgba(15,23,42,0.65);">
      <p><strong>Name:</strong> ${user.displayName || 'N/A'}</p>
      <p><strong>Email:</strong> ${user.email}</p>
      <p><strong>User ID:</strong> ${user.id}</p>
      <p><strong>Verified:</strong> ${user.verified ? 'Yes' : 'No'}</p>
      <p><strong>Euros:</strong> €${Number(user.euros || 0).toFixed(2)}</p>
    </div>
  `;
}

function getTemplate() {
  return `
    <section class="card">
      <h2>Admin coin controls</h2>
      <form id="admin-search" class="form">
        <label>Email
          <input name="email" type="email" placeholder="player@example.com" />
        </label>
        <label>User ID
          <input name="userId" placeholder="uuid" />
        </label>
        <button class="accent" type="submit">Find user</button>
      </form>
      <div id="admin-details"></div>
      <form id="admin-update" class="form">
        <input type="hidden" name="userId" />
        <label>New balance (€)
          <input name="balance" type="number" step="0.01" min="0" required />
        </label>
        <button class="accent" type="submit">Update balance</button>
      </form>
      <div id="admin-status" class="alert info" hidden></div>
    </section>
  `;
}

export { mountAdminView };
