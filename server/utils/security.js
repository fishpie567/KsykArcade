const crypto = require('crypto');

const HASH_ITERATIONS = 310000;
const HASH_KEYLEN = 32;
const HASH_DIGEST = 'sha256';

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const derivedKey = crypto.pbkdf2Sync(password, salt, HASH_ITERATIONS, HASH_KEYLEN, HASH_DIGEST).toString('hex');
  return { salt, hash: derivedKey };
}

function verifyPassword(password, salt, hash) {
  const derivedKey = crypto.pbkdf2Sync(password, salt, HASH_ITERATIONS, HASH_KEYLEN, HASH_DIGEST).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(derivedKey, 'hex'));
}

function generateToken(bytes = 48) {
  return crypto.randomBytes(bytes).toString('hex');
}

function generateJwt(payload, secret, expiresInSeconds = 60 * 60 * 12) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const issuedAt = Math.floor(Date.now() / 1000);
  const exp = issuedAt + expiresInSeconds;
  const tokenPayload = { ...payload, iat: issuedAt, exp };
  const base64UrlEncode = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const headerPart = base64UrlEncode(header);
  const payloadPart = base64UrlEncode(tokenPayload);
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${headerPart}.${payloadPart}`)
    .digest('base64url');
  return `${headerPart}.${payloadPart}.${signature}`;
}

function verifyJwt(token, secret) {
  if (!token) return null;
  const [headerPart, payloadPart, signature] = token.split('.');
  if (!headerPart || !payloadPart || !signature) return null;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(`${headerPart}.${payloadPart}`)
    .digest('base64url');
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    return null;
  }
  const payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf-8'));
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }
  return payload;
}

module.exports = {
  hashPassword,
  verifyPassword,
  generateToken,
  generateJwt,
  verifyJwt,
};
