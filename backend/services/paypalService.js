const { RequestError } = require('../utils/errors');

class PayPalService {
  constructor(userService) {
    this.userService = userService;
  }

  async createOrder(userId, { euros }) {
    const amount = Number(euros);
    if (!amount || amount <= 0) {
      throw new RequestError('Invalid amount');
    }
    const unitPrice = Number(process.env.EURO_UNIT_PRICE || 1);
    const total = (amount * unitPrice).toFixed(2);
    const body = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: {
            currency_code: process.env.PAYPAL_CURRENCY || 'USD',
            value: total,
          },
          custom_id: userId,
        },
      ],
    };
    const response = await this.paypalFetch('/v2/checkout/orders', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) {
      const message = data.message || 'Failed to create order';
      const error = new RequestError(message);
      error.statusCode = response.status;
      throw error;
    }
    return data;
  }

  async captureOrder(userId, { orderId }) {
    if (!orderId) throw new RequestError('orderId missing');
    const response = await this.paypalFetch(`/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
    });
    const data = await response.json();
    if (!response.ok) {
      const message = data.message || 'Failed to capture order';
      const error = new RequestError(message);
      error.statusCode = response.status;
      throw error;
    }
    const captured = data.purchase_units?.[0]?.payments?.captures?.[0];
    const customId = data.purchase_units?.[0]?.custom_id;
    const amountValue = Number(captured?.amount?.value || 0);
    const currency = captured?.amount?.currency_code;
    const unitPrice = Number(process.env.EURO_UNIT_PRICE || 1);
    const eurosPurchased = unitPrice ? Math.round((amountValue / unitPrice) * 100) / 100 : 0;
    if (customId && customId !== userId) {
      throw new RequestError('Order does not belong to this user', 403);
    }
    await this.userService.incrementBalance(userId, eurosPurchased);
    await this.userService.addTransaction({
      userId,
      orderId,
      euros: eurosPurchased,
      amountPaid: amountValue,
      currency,
      status: captured?.status || 'COMPLETED',
    });
    return { success: true, balance: await this.userService.getBalance(userId) };
  }

  async paypalFetch(endpoint, options = {}) {
    const base = process.env.PAYPAL_API_BASE || 'https://api-m.sandbox.paypal.com';
    const token = await this.getAccessToken();
    const res = await fetch(`${base}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });
    return res;
  }

  async getAccessToken() {
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const secret = process.env.PAYPAL_CLIENT_SECRET;
    if (!clientId || !secret) {
      throw new RequestError('PayPal credentials not configured', 500);
    }
    const base = process.env.PAYPAL_API_BASE || 'https://api-m.sandbox.paypal.com';
    const credentials = Buffer.from(`${clientId}:${secret}`).toString('base64');
    const res = await fetch(`${base}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    if (!res.ok) {
      const text = await res.text();
      const error = new RequestError(`Failed to obtain PayPal token: ${text}`, res.status);
      throw error;
    }
    const data = await res.json();
    return data.access_token;
  }
}

module.exports = { PayPalService };
