const http = require('http');
const path = require('path');
const fs = require('fs');
const url = require('url');
const querystring = require('querystring');
const crypto = require('crypto');
const { withDatabase, readDatabase } = require('./utils/db');
const { hashPassword, verifyPassword, generateToken, generateJwt, verifyJwt } = require('./utils/security');
const { sendVerificationEmail } = require('./services/emailService');
const { createOrder, captureOrder } = require('./services/paypalService');

const PORT = Number(process.env.PORT || 4000);
const JWT_SECRET = process.env.JWT_SECRET || 'development-secret-change-me';
const CLIENT_DIR = path.join(__dirname, '..', 'client');

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
  });
  res.end(body);
}

function sendError(res, statusCode, message, details) {
  sendJson(res, statusCode, { error: message, details });
}

function sendNoContent(res) {
  res.writeHead(204, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
  });
  res.end();
}

async function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1e6) {
        reject(new Error('Request body too large'));
        req.connection.destroy();
      }
    });
    req.on('end', () => {
      if (!data) {
        resolve({});
        return;
      }
      try {
        const contentType = req.headers['content-type'] || '';
        if (contentType.includes('application/json')) {
          resolve(JSON.parse(data));
        } else if (contentType.includes('application/x-www-form-urlencoded')) {
          resolve(querystring.parse(data));
        } else {
          resolve({ raw: data });
        }
      } catch (err) {
        reject(err);
      }
    });
  });
}

function authenticateRequest(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  const payload = verifyJwt(token, JWT_SECRET);
  return payload;
}

function sanitizeUser(user) {
  if (!user) return null;
  const { passwordHash, passwordSalt, verificationToken, verificationTokenExpiresAt, ...rest } = user;
  return rest;
}

function ensureCors(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
    });
    res.end();
    return true;
  }
  return false;
}

async function handleApiRequest(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const { pathname } = parsedUrl;

  if (pathname === '/api/auth/register' && req.method === 'POST') {
    try {
      const body = await parseRequestBody(req);
      const { email, password, displayName } = body;
      if (!email || !password) {
        return sendError(res, 400, 'Email and password are required');
      }
      if (password.length < 8) {
        return sendError(res, 400, 'Password must be at least 8 characters long');
      }
      const normalizedEmail = String(email).trim().toLowerCase();
      const name = (displayName || normalizedEmail.split('@')[0]).trim().slice(0, 60);
      let verificationToken;
      const user = withDatabase((db) => {
        const existing = db.users.find((u) => u.email === normalizedEmail);
        if (existing) {
          throw new Error('Account already exists for this email');
        }
        const { salt, hash } = hashPassword(password);
        verificationToken = generateToken(24);
        const now = new Date().toISOString();
        const newUser = {
          id: crypto.randomUUID(),
          email: normalizedEmail,
          displayName: name || 'Player',
          passwordHash: hash,
          passwordSalt: salt,
          verified: false,
          verificationToken,
          verificationTokenExpiresAt: Date.now() + 1000 * 60 * 60 * 24,
          balanceEuros: 0,
          createdAt: now,
          updatedAt: now,
          googleSub: null,
          isAdmin: db.users.length === 0,
        };
        db.users.push(newUser);
        return sanitizeUser(newUser);
      });

      await sendVerificationEmail({ to: normalizedEmail, verificationToken });
      return sendJson(res, 201, { message: 'Account created. Check your email for the verification link.', user });
    } catch (err) {
      console.error(err);
      return sendError(res, 400, err.message || 'Registration failed');
    }
  }

  if (pathname === '/api/auth/resend-verification' && req.method === 'POST') {
    try {
      const body = await parseRequestBody(req);
      const { email } = body;
      if (!email) {
        return sendError(res, 400, 'Email is required');
      }
      const normalizedEmail = String(email).trim().toLowerCase();
      let verificationToken;
      const user = withDatabase((db) => {
        const existing = db.users.find((u) => u.email === normalizedEmail);
        if (!existing) {
          throw new Error('No account found for this email');
        }
        if (existing.verified) {
          throw new Error('Account is already verified');
        }
        verificationToken = generateToken(24);
        existing.verificationToken = verificationToken;
        existing.verificationTokenExpiresAt = Date.now() + 1000 * 60 * 60 * 24;
        existing.updatedAt = new Date().toISOString();
        return sanitizeUser(existing);
      });

      await sendVerificationEmail({ to: normalizedEmail, verificationToken });
      return sendJson(res, 200, { message: 'Verification email sent', user });
    } catch (err) {
      console.error(err);
      return sendError(res, 400, err.message || 'Could not send verification email');
    }
  }

  if (pathname === '/api/auth/verify' && req.method === 'POST') {
    try {
      const body = await parseRequestBody(req);
      const { token } = body;
      if (!token) {
        return sendError(res, 400, 'Verification token is required');
      }
      const user = withDatabase((db) => {
        const match = db.users.find((u) => u.verificationToken === token);
        if (!match) {
          throw new Error('Invalid verification token');
        }
        if (match.verified) {
          return sanitizeUser(match);
        }
        if (match.verificationTokenExpiresAt && match.verificationTokenExpiresAt < Date.now()) {
          throw new Error('Verification token has expired. Request a new one.');
        }
        match.verified = true;
        match.verificationToken = null;
        match.verificationTokenExpiresAt = null;
        match.updatedAt = new Date().toISOString();
        return sanitizeUser(match);
      });
      return sendJson(res, 200, { message: 'Email verified successfully', user });
    } catch (err) {
      return sendError(res, 400, err.message || 'Verification failed');
    }
  }

  if (pathname === '/api/auth/login' && req.method === 'POST') {
    try {
      const body = await parseRequestBody(req);
      const { email, password } = body;
      if (!email || !password) {
        return sendError(res, 400, 'Email and password are required');
      }
      const normalizedEmail = String(email).trim().toLowerCase();
      const db = readDatabase();
      const user = db.users.find((u) => u.email === normalizedEmail);
      if (!user) {
        throw new Error('Invalid email or password');
      }
      if (!user.passwordHash || !user.passwordSalt) {
        throw new Error('Password login is not available for this account');
      }
      if (!verifyPassword(password, user.passwordSalt, user.passwordHash)) {
        throw new Error('Invalid email or password');
      }
      if (!user.verified) {
        throw new Error('Please verify your email before logging in.');
      }
      const token = generateJwt({ sub: user.id, email: user.email, isAdmin: !!user.isAdmin }, JWT_SECRET);
      return sendJson(res, 200, { token, user: sanitizeUser(user) });
    } catch (err) {
      return sendError(res, 401, err.message || 'Login failed');
    }
  }

  if (pathname === '/api/auth/google' && req.method === 'POST') {
    try {
      const body = await parseRequestBody(req);
      const { credential } = body;
      if (!credential) {
        return sendError(res, 400, 'Google credential is required');
      }
      const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
      if (!response.ok) {
        throw new Error('Failed to verify Google credential');
      }
      const tokenInfo = await response.json();
      const audience = process.env.GOOGLE_CLIENT_ID;
      if (audience && tokenInfo.aud !== audience) {
        throw new Error('Google credential audience mismatch');
      }
      const googleSub = tokenInfo.sub;
      const email = tokenInfo.email?.toLowerCase();
      const displayName = tokenInfo.name || tokenInfo.email;
      let sanitized;
      const user = withDatabase((db) => {
        let existing = db.users.find((u) => u.googleSub === googleSub || (email && u.email === email));
        const now = new Date().toISOString();
        if (!existing) {
          existing = {
            id: crypto.randomUUID(),
            email,
            displayName,
            googleSub,
            passwordHash: null,
            passwordSalt: null,
            verified: true,
            verificationToken: null,
            verificationTokenExpiresAt: null,
            balanceEuros: 0,
            createdAt: now,
            updatedAt: now,
            isAdmin: db.users.length === 0,
          };
          db.users.push(existing);
        } else {
          existing.googleSub = googleSub;
          existing.email = email || existing.email;
          existing.displayName = displayName || existing.displayName;
          existing.verified = true;
          existing.updatedAt = now;
        }
        sanitized = sanitizeUser(existing);
        return sanitized;
      });
      const token = generateJwt({ sub: user.id, email: user.email, isAdmin: !!user.isAdmin }, JWT_SECRET);
      return sendJson(res, 200, { token, user });
    } catch (err) {
      console.error(err);
      return sendError(res, 401, err.message || 'Google sign-in failed');
    }
  }

  if (pathname === '/api/user' && req.method === 'GET') {
    const auth = authenticateRequest(req);
    if (!auth) {
      return sendError(res, 401, 'Unauthorized');
    }
    const db = readDatabase();
    const user = db.users.find((u) => u.id === auth.sub);
    if (!user) {
      return sendError(res, 404, 'User not found');
    }
    return sendJson(res, 200, { user: sanitizeUser(user) });
  }

  if (pathname === '/api/paypal/create-order' && req.method === 'POST') {
    const auth = authenticateRequest(req);
    if (!auth) {
      return sendError(res, 401, 'Unauthorized');
    }
    try {
      const body = await parseRequestBody(req);
      const { amount } = body;
      const numericAmount = Number.parseFloat(amount);
      if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        return sendError(res, 400, 'A positive amount is required');
      }
      const order = await createOrder({ amount: numericAmount.toFixed(2) });
      return sendJson(res, 200, order);
    } catch (err) {
      console.error(err);
      return sendError(res, 400, err.message || 'Failed to create PayPal order');
    }
  }

  if (pathname === '/api/paypal/capture-order' && req.method === 'POST') {
    const auth = authenticateRequest(req);
    if (!auth) {
      return sendError(res, 401, 'Unauthorized');
    }
    try {
      const body = await parseRequestBody(req);
      const { orderId } = body;
      if (!orderId) {
        return sendError(res, 400, 'orderId is required');
      }
      const capture = await captureOrder(orderId);
      let amount = 0;
      const captureUnit = capture?.purchase_units?.[0];
      if (captureUnit?.payments?.captures?.length) {
        const captureInfo = captureUnit.payments.captures[0];
        amount = Number.parseFloat(captureInfo.amount?.value || '0');
      }
      const user = withDatabase((db) => {
        const existing = db.users.find((u) => u.id === auth.sub);
        if (!existing) {
          throw new Error('User not found');
        }
        existing.balanceEuros = Number.parseFloat((existing.balanceEuros + amount).toFixed(2));
        existing.updatedAt = new Date().toISOString();
        db.transactions.push({
          id: crypto.randomUUID(),
          userId: existing.id,
          orderId,
          provider: 'paypal',
          amount,
          currency: 'EUR',
          createdAt: new Date().toISOString(),
          raw: capture,
        });
        return sanitizeUser(existing);
      });
      return sendJson(res, 200, { message: 'Payment captured', amount, user, capture });
    } catch (err) {
      console.error(err);
      return sendError(res, 400, err.message || 'Failed to capture PayPal order');
    }
  }

  if (pathname === '/api/admin/users' && req.method === 'GET') {
    const auth = authenticateRequest(req);
    if (!auth || !auth.isAdmin) {
      return sendError(res, 403, 'Admin access required');
    }
    const db = readDatabase();
    const users = db.users.map(sanitizeUser);
    return sendJson(res, 200, { users });
  }

  if (pathname.startsWith('/api/admin/users/') && req.method === 'PATCH') {
    const auth = authenticateRequest(req);
    if (!auth || !auth.isAdmin) {
      return sendError(res, 403, 'Admin access required');
    }
    const userId = pathname.split('/')[4];
    if (!userId) {
      return sendError(res, 400, 'User ID is required');
    }
    try {
      const body = await parseRequestBody(req);
      const { balanceEuros, deltaEuros } = body;
      const user = withDatabase((db) => {
        const target = db.users.find((u) => u.id === userId);
        if (!target) {
          throw new Error('User not found');
        }
        if (typeof balanceEuros === 'number' && Number.isFinite(balanceEuros)) {
          target.balanceEuros = Number.parseFloat(balanceEuros.toFixed(2));
        } else if (typeof deltaEuros === 'number' && Number.isFinite(deltaEuros)) {
          target.balanceEuros = Number.parseFloat((target.balanceEuros + deltaEuros).toFixed(2));
        }
        target.updatedAt = new Date().toISOString();
        return sanitizeUser(target);
      });
      return sendJson(res, 200, { user });
    } catch (err) {
      return sendError(res, 400, err.message || 'Failed to update balance');
    }
  }

  if (pathname === '/api/transactions' && req.method === 'GET') {
    const auth = authenticateRequest(req);
    if (!auth) {
      return sendError(res, 401, 'Unauthorized');
    }
    const db = readDatabase();
    const transactions = db.transactions
      .filter((tx) => tx.userId === auth.sub)
      .map((tx) => ({ ...tx, raw: undefined }));
    return sendJson(res, 200, { transactions });
  }

  return false;
}

function serveStaticFile(res, filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const contentTypeMap = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.txt': 'text/plain; charset=utf-8',
  };
  const contentType = contentTypeMap[extension] || 'application/octet-stream';
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  if (ensureCors(req, res)) {
    return;
  }
  const parsedUrl = url.parse(req.url);
  if (parsedUrl.pathname.startsWith('/api/')) {
    const handled = await handleApiRequest(req, res);
    if (!handled) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    }
    return;
  }

  let requestedPath = parsedUrl.pathname;
  if (requestedPath === '/') {
    requestedPath = '/index.html';
  }
  const filePath = path.join(CLIENT_DIR, requestedPath);
  if (!filePath.startsWith(CLIENT_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }
  serveStaticFile(res, filePath);
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
