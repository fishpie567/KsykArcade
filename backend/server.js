const http = require('http');
const path = require('path');
const { parse } = require('url');
const { loadEnv } = require('./utils/env');
const { UserService } = require('./services/userService');
const { AuthService } = require('./services/authService');
const { PayPalService } = require('./services/paypalService');
const { GameService } = require('./services/gameService');
const { staticHandler } = require('./utils/staticHandler');
const { jsonResponse, parseBody, notFound } = require('./utils/httpHelpers');

loadEnv(path.resolve(__dirname, '..', '.env'));

const PORT = process.env.PORT || 3000;
const FRONTEND_DIR = path.resolve(__dirname, '..', 'frontend');

const userService = new UserService(path.resolve(__dirname, 'data'));
const authService = new AuthService(userService);
const paypalService = new PayPalService(userService);
const gameService = new GameService(path.resolve(__dirname, 'data'));

const server = http.createServer(async (req, res) => {
  const url = parse(req.url, true);
  const method = req.method || 'GET';

  if (url.pathname && url.pathname.startsWith('/api/')) {
    try {
      await handleApiRequest({ req, res, url, method });
    } catch (error) {
      console.error('API error', error);
      if (!res.headersSent) {
        jsonResponse(res, 500, { error: 'Internal server error' });
      }
    }
    return;
  }

  staticHandler(req, res, FRONTEND_DIR);
});

async function handleApiRequest({ req, res, url, method }) {
  const cookies = parseCookies(req.headers['cookie']);
  const sessionToken = cookies.sessionToken;
  const session = sessionToken ? await authService.getSession(sessionToken) : null;

  if (url.pathname === '/api/auth/register' && method === 'POST') {
    return handle(res, async () => {
      const body = await parseBody(req);
      const result = await authService.register(body);
      jsonResponse(res, 201, result);
    });
  }

  if (url.pathname === '/api/config' && method === 'GET') {
    return handle(res, async () => {
      jsonResponse(res, 200, {
        paypalClientId: process.env.PAYPAL_CLIENT_ID || null,
        currency: process.env.PAYPAL_CURRENCY || 'USD',
        unitPrice: Number(process.env.EURO_UNIT_PRICE || 1),
        googleClientId: process.env.GOOGLE_CLIENT_ID || null,
      });
    });
  }

  if (url.pathname === '/api/auth/verify' && method === 'POST') {
    return handle(res, async () => {
      const body = await parseBody(req);
      const result = await authService.verifyEmail(body.token);
      jsonResponse(res, 200, result);
    });
  }

  if (url.pathname === '/api/auth/resend' && method === 'POST') {
    return handle(res, async () => {
      const body = await parseBody(req);
      const result = await authService.resendVerification(body.email);
      jsonResponse(res, 200, result);
    });
  }

  if (url.pathname === '/api/auth/login' && method === 'POST') {
    return handle(res, async () => {
      const body = await parseBody(req);
      const { token, user } = await authService.login(body);
      setSessionCookie(res, token);
      jsonResponse(res, 200, { user });
    });
  }

  if (url.pathname === '/api/auth/google' && method === 'POST') {
    return handle(res, async () => {
      const body = await parseBody(req);
      const { token, user } = await authService.googleLogin(body.idToken);
      setSessionCookie(res, token);
      jsonResponse(res, 200, { user });
    });
  }

  if (url.pathname === '/api/auth/logout' && method === 'POST') {
    return handle(res, async () => {
      if (sessionToken) {
        await authService.logout(sessionToken);
      }
      res.setHeader('Set-Cookie', 'sessionToken=; HttpOnly; Path=/; Max-Age=0');
      jsonResponse(res, 200, { success: true });
    });
  }

  if (url.pathname === '/api/auth/me' && method === 'GET') {
    if (!session) {
      jsonResponse(res, 401, { error: 'Unauthorized' });
      return;
    }
    return handle(res, async () => {
      const user = await userService.getById(session.userId);
      jsonResponse(res, 200, { user: userService.sanitizeUser(user) });
    });
  }

  if (url.pathname === '/api/coins/balance' && method === 'GET') {
    if (!session) {
      jsonResponse(res, 401, { error: 'Unauthorized' });
      return;
    }
    return handle(res, async () => {
      const balance = await userService.getBalance(session.userId);
      jsonResponse(res, 200, { balance });
    });
  }

  if (url.pathname === '/api/coins/transactions' && method === 'GET') {
    if (!session) {
      jsonResponse(res, 401, { error: 'Unauthorized' });
      return;
    }
    return handle(res, async () => {
      const transactions = await userService.listTransactions(session.userId);
      jsonResponse(res, 200, { transactions });
    });
  }

  if (url.pathname === '/api/coins/update' && method === 'POST') {
    if (!session) {
      jsonResponse(res, 401, { error: 'Unauthorized' });
      return;
    }
    const currentUser = await userService.getById(session.userId);
    if (!currentUser || currentUser.role !== 'admin') {
      jsonResponse(res, 403, { error: 'Forbidden' });
      return;
    }
    return handle(res, async () => {
      const body = await parseBody(req);
      let target = null;
      if (body.userId) {
        target = await userService.getById(body.userId);
      } else if (body.email) {
        target = await userService.getByEmail(body.email);
      }
      if (!target) {
        const error = new Error('Target user not found');
        error.statusCode = 404;
        throw error;
      }
      await userService.setBalance(target.id, body.balance);
      jsonResponse(res, 200, { success: true });
    });
  }

  if (url.pathname === '/api/admin/users/find' && method === 'POST') {
    if (!session) {
      jsonResponse(res, 401, { error: 'Unauthorized' });
      return;
    }
    const currentUser = await userService.getById(session.userId);
    if (!currentUser || currentUser.role !== 'admin') {
      jsonResponse(res, 403, { error: 'Forbidden' });
      return;
    }
    return handle(res, async () => {
      const body = await parseBody(req);
      let user = null;
      if (body.email) {
        user = await userService.getByEmail(body.email);
      } else if (body.userId) {
        user = await userService.getById(body.userId);
      }
      if (!user) {
        const error = new Error('User not found');
        error.statusCode = 404;
        throw error;
      }
      jsonResponse(res, 200, { user: userService.sanitizeUser(user) });
    });
  }

  if (url.pathname === '/api/paypal/create-order' && method === 'POST') {
    if (!session) {
      jsonResponse(res, 401, { error: 'Unauthorized' });
      return;
    }
    return handle(res, async () => {
      const body = await parseBody(req);
      const order = await paypalService.createOrder(session.userId, body);
      jsonResponse(res, 200, order);
    });
  }

  if (url.pathname === '/api/paypal/capture-order' && method === 'POST') {
    if (!session) {
      jsonResponse(res, 401, { error: 'Unauthorized' });
      return;
    }
    return handle(res, async () => {
      const body = await parseBody(req);
      const result = await paypalService.captureOrder(session.userId, body);
      jsonResponse(res, 200, result);
    });
  }

  if (url.pathname === '/api/games' && method === 'GET') {
    return handle(res, async () => {
      const games = await gameService.listGames();
      jsonResponse(res, 200, { games });
    });
  }

  notFound(res);
}

function setSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === 'production';
  const cookie = [
    `sessionToken=${token}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    secure ? 'Secure' : '',
    'Max-Age=604800'
  ].filter(Boolean).join('; ');
  res.setHeader('Set-Cookie', cookie);
}

function parseCookies(cookieHeader) {
  if (!cookieHeader) return {};
  return cookieHeader.split(';').reduce((acc, pair) => {
    const [key, value] = pair.trim().split('=');
    acc[key] = decodeURIComponent(value || '');
    return acc;
  }, {});
}

async function handle(res, fn) {
  try {
    await fn();
  } catch (error) {
    const status = error.statusCode || 400;
    if (status >= 500) {
      console.error('Internal error:', error);
    }
    jsonResponse(res, status, { error: error.message || 'Request failed' });
  }
}

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
