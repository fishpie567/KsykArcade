const API = {
  async getConfig() {
    return request('/api/config');
  },
  async register(payload) {
    return request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  async login(payload) {
    return request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  async googleLogin(idToken) {
    return request('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    });
  },
  async logout() {
    return request('/api/auth/logout', { method: 'POST' });
  },
  async resend(email) {
    return request('/api/auth/resend', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },
  async me() {
    return request('/api/auth/me');
  },
  async verify(token) {
    return request('/api/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  },
  async getBalance() {
    return request('/api/coins/balance');
  },
  async getTransactions() {
    return request('/api/coins/transactions');
  },
  async createOrder(euros) {
    return request('/api/paypal/create-order', {
      method: 'POST',
      body: JSON.stringify({ euros }),
    });
  },
  async captureOrder(orderId) {
    return request('/api/paypal/capture-order', {
      method: 'POST',
      body: JSON.stringify({ orderId }),
    });
  },
  async updateCoins(payload) {
    return request('/api/coins/update', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  async findUser(payload) {
    return request('/api/admin/users/find', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  async listGames() {
    return request('/api/games');
  },
};

async function request(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : {};
  } catch (error) {
    data = { error: 'Invalid response format' };
  }
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export { API };
