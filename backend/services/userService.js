const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { DataStore } = require('../utils/dataStore');
const { RequestError } = require('../utils/errors');

class UserService {
  constructor(baseDir) {
    this.users = new DataStore(baseDir, 'users');
    this.sessions = new DataStore(baseDir, 'sessions');
    this.transactions = new DataStore(baseDir, 'transactions');
  }

  async createUser({ email, password, displayName }) {
    const existing = await this.getByEmail(email);
    if (existing) {
      throw new RequestError('Email already registered', 409);
    }
    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = await this.hashPassword(password, salt);
    const verificationToken = crypto.randomBytes(24).toString('hex');
    const now = new Date().toISOString();
    const user = {
      id: crypto.randomUUID(),
      email: email.toLowerCase(),
      passwordHash,
      salt,
      displayName,
      googleId: null,
      verified: false,
      verificationToken,
      verificationSentAt: now,
      role: 'user',
      euros: 0,
      createdAt: now,
      updatedAt: now,
    };
    const users = await this.users.read();
    users.push(user);
    await this.users.write(users);
    return user;
  }

  async createGoogleUser({ email, googleId, displayName }) {
    const existingEmail = await this.getByEmail(email);
    if (existingEmail) {
      const updated = { ...existingEmail, googleId, verified: true };
      await this.updateUser(updated);
      return updated;
    }
    const now = new Date().toISOString();
    const user = {
      id: crypto.randomUUID(),
      email: email.toLowerCase(),
      passwordHash: null,
      salt: null,
      displayName,
      googleId,
      verified: true,
      verificationToken: null,
      verificationSentAt: null,
      role: 'user',
      euros: 0,
      createdAt: now,
      updatedAt: now,
    };
    const users = await this.users.read();
    users.push(user);
    await this.users.write(users);
    return user;
  }

  async updateUser(user) {
    const users = await this.users.read();
    const idx = users.findIndex((u) => u.id === user.id);
    if (idx === -1) {
      throw new Error('User not found');
    }
    users[idx] = { ...users[idx], ...user, updatedAt: new Date().toISOString() };
    await this.users.write(users);
    return users[idx];
  }

  async hasAdmin() {
    const users = await this.users.read();
    return users.some((u) => u.role === 'admin');
  }

  async getByEmail(email) {
    const users = await this.users.read();
    return users.find((u) => u.email === (email || '').toLowerCase());
  }

  async getById(id) {
    const users = await this.users.read();
    return users.find((u) => u.id === id);
  }

  async storeSession(userId) {
    const token = crypto.randomUUID();
    const sessions = await this.sessions.read();
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
    const session = { token, userId, expiresAt };
    sessions.push(session);
    await this.sessions.write(sessions);
    return session;
  }

  async getSession(token) {
    const sessions = await this.sessions.read();
    const session = sessions.find((s) => s.token === token);
    if (!session) return null;
    if (session.expiresAt < Date.now()) {
      await this.deleteSession(token);
      return null;
    }
    return session;
  }

  async deleteSession(token) {
    const sessions = await this.sessions.read();
    const filtered = sessions.filter((s) => s.token !== token);
    await this.sessions.write(filtered);
  }

  async hashPassword(password, salt) {
    return new Promise((resolve, reject) => {
      crypto.pbkdf2(password, salt, 310000, 32, 'sha256', (err, hashed) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(hashed.toString('hex'));
      });
    });
  }

  async verifyPassword(password, user) {
    if (!user.passwordHash || !user.salt) return false;
    const hash = await this.hashPassword(password, user.salt);
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(user.passwordHash, 'hex'));
  }

  sanitizeUser(user) {
    if (!user) return null;
    const { passwordHash, salt, verificationToken, ...safe } = user;
    return safe;
  }

  async getBalance(userId) {
    const user = await this.getById(userId);
    if (!user) throw new RequestError('User not found', 404);
    return user.euros;
  }

  async setBalance(userId, balance) {
    const user = await this.getById(userId);
    if (!user) throw new RequestError('User not found', 404);
    user.euros = Number(balance) || 0;
    await this.updateUser(user);
  }

  async incrementBalance(userId, amount) {
    const user = await this.getById(userId);
    if (!user) throw new RequestError('User not found', 404);
    user.euros = (user.euros || 0) + amount;
    await this.updateUser(user);
    return user.euros;
  }

  async addTransaction(record) {
    const transactions = await this.transactions.read();
    transactions.push({ id: crypto.randomUUID(), ...record, createdAt: new Date().toISOString() });
    await this.transactions.write(transactions);
  }

  async listTransactions(userId) {
    const transactions = await this.transactions.read();
    return transactions.filter((t) => t.userId === userId);
  }
}

module.exports = { UserService };
