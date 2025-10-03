import { API } from './api.js';
import { setUser, state } from './state.js';

let scriptPromise = null;
let initialized = false;

function loadScript() {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-google-client]');
    if (existing) {
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load Google script')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.dataset.googleClient = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google script'));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

async function renderGoogleButton(container, { onError } = {}) {
  if (!state.config?.googleClientId) {
    container.innerHTML = '<p class="alert">Google login is not configured.</p>';
    return;
  }
  await loadScript();
  if (!initialized && window.google?.accounts?.id) {
    window.google.accounts.id.initialize({
      client_id: state.config.googleClientId,
      callback: handleCredential,
      ux_mode: 'popup',
    });
    initialized = true;
  }
  if (window.google?.accounts?.id) {
    container.innerHTML = '';
    window.google.accounts.id.renderButton(container, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      shape: 'pill',
      text: 'signin_with',
    });
  } else if (onError) {
    onError(new Error('Google script not available'));
  }
}

async function handleCredential(response) {
  try {
    const data = await API.googleLogin(response.credential);
    setUser(data.user);
    document.dispatchEvent(new CustomEvent('auth:completed'));
  } catch (error) {
    console.error('Google login failed', error);
    document.dispatchEvent(
      new CustomEvent('auth:error', {
        detail: error.message,
      })
    );
  }
}

export { renderGoogleButton };
