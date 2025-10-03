import { API } from './api.js';
import { renderVerify } from './ui.js';

const view = document.getElementById('verify-view');
const token = new URLSearchParams(window.location.search).get('token');

async function init() {
  try {
    view.innerHTML = renderVerify(token, 'Verifying your account...');
    if (!token) return;
    await API.verify(token);
    view.innerHTML = renderVerify(token, 'Success! Your email is verified. You can close this tab.');
  } catch (error) {
    view.innerHTML = renderVerify(token, error.message);
  }
}

init();
