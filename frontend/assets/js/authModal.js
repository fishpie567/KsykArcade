import { API } from './api.js';
import { setUser } from './state.js';
import { renderGoogleButton } from './googleAuth.js';

const modalRoot = document.getElementById('modal-root');
let currentModal = null;

function openAuthModal(mode = 'login') {
  closeModal();
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = getModalTemplate(mode);
  modalRoot.appendChild(modal);
  currentModal = modal;
  modal.addEventListener('click', (event) => {
    if (event.target === modal) {
      closeModal();
    }
  });
  modal.querySelectorAll('[data-switch]').forEach((btn) => {
    btn.addEventListener('click', () => openAuthModal(btn.dataset.switch));
  });
  const form = modal.querySelector('form');
  form.addEventListener('submit', (event) => handleSubmit(event, mode));
  setupGoogle(modal, mode);
}

function closeModal() {
  if (currentModal) {
    currentModal.remove();
    currentModal = null;
  }
}

document.addEventListener('auth:completed', () => closeModal());
document.addEventListener('auth:error', (event) => {
  const message = event.detail || 'Google login failed';
  showStatus(message, 'error');
});

async function handleSubmit(event, mode) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form).entries());
  try {
    showStatus('Processing...', 'info');
    if (mode === 'register') {
      await API.register(data);
      showStatus('Account created! Please check your email to verify.', 'success');
      form.reset();
    } else {
      const result = await API.login(data);
      setUser(result.user);
      showStatus('Welcome back!', 'success');
      setTimeout(() => closeModal(), 400);
    }
  } catch (error) {
    showStatus(error.message, 'error');
  }
}

function showStatus(message, type) {
  const status = document.querySelector('.modal-status');
  if (!status) return;
  status.textContent = message;
  status.dataset.type = type;
  status.hidden = false;
}

function setupGoogle(modal, mode) {
  if (mode !== 'login') return;
  const container = modal.querySelector('#google-btn');
  if (!container) return;
  renderGoogleButton(container, {
    onError: (error) => {
      container.innerHTML = `<p class="alert error">${error.message}</p>`;
    },
  });
}

function getModalTemplate(mode) {
  const isRegister = mode === 'register';
  return `
    <div class="modal">
      <button class="close" data-action="close">×</button>
      <div class="tabs">
        <button class="tab ${isRegister ? 'active' : ''}" data-switch="register">Sign up</button>
        <button class="tab ${!isRegister ? 'active' : ''}" data-switch="login">Log in</button>
      </div>
      <form class="form auth-form">
        ${isRegister ? '<label>Display name<input name="displayName" required /></label>' : ''}
        <label>Email<input type="email" name="email" required /></label>
        <label>Password<input type="password" name="password" required minlength="6" /></label>
        <button type="submit" class="accent">${isRegister ? 'Create account' : 'Log in'}</button>
      </form>
      <div id="google-btn"></div>
      <p class="modal-status alert" hidden></p>
      <p class="hint">${isRegister ? 'After signing up we will send you a verification link.' : 'Verified users can log in with email/password or Google.'}</p>
    </div>
  `;
}

modalRoot.addEventListener('click', (event) => {
  if (event.target.matches('[data-action="close"]')) {
    closeModal();
  }
});

export { openAuthModal, closeModal };
