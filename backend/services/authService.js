const crypto = require('crypto');
const { UserService } = require('./userService');
const { sendEmail } = require('./emailService');
const { RequestError } = require('../utils/errors');

class AuthService {
  constructor(userService) {
    this.userService = userService;
  }

  async register({ email, password, displayName }) {
    if (!email || !password || !displayName) {
      throw new RequestError('Missing required fields');
    }
    const user = await this.userService.createUser({ email, password, displayName });
    if (!(await this.userService.hasAdmin())) {
      user.role = 'admin';
      await this.userService.updateUser(user);
    }
    await this.sendVerification(user);
    return { user: this.userService.sanitizeUser(user) };
  }

  async resendVerification(email) {
    if (!email) throw new RequestError('Email is required');
    const user = await this.userService.getByEmail(email);
    if (!user) {
      throw new RequestError('User not found', 404);
    }
    if (user.verified) {
      return { message: 'Already verified' };
    }
    user.verificationToken = crypto.randomBytes(24).toString('hex');
    await this.userService.updateUser(user);
    await this.sendVerification(user);
    return { message: 'Verification email sent' };
  }

  async sendVerification(user) {
    const verifyUrl = `${process.env.APP_URL || 'http://localhost:3000'}/verify.html?token=${user.verificationToken}`;
    const subject = 'Verify your Euro Arcade account';
    const html = `
      <h1>Welcome to Euro Arcade</h1>
      <p>Hi ${user.displayName || 'there'},</p>
      <p>Please verify your email by clicking the link below:</p>
      <p><a href="${verifyUrl}">${verifyUrl}</a></p>
      <p>If you did not create this account, you can ignore this email.</p>
    `;
    await sendEmail({
      to: user.email,
      subject,
      html,
    });
  }

  async verifyEmail(token) {
    if (!token) throw new RequestError('Token missing');
    const users = await this.userService.users.read();
    const user = users.find((u) => u.verificationToken === token);
    if (!user) {
      throw new RequestError('Invalid token', 404);
    }
    user.verified = true;
    user.verificationToken = null;
    await this.userService.updateUser(user);
    return { success: true };
  }

  async login({ email, password }) {
    if (!email || !password) throw new RequestError('Missing credentials');
    const user = await this.userService.getByEmail(email);
    if (!user) throw new RequestError('Invalid credentials', 401);
    if (!user.verified) throw new RequestError('Please verify your email first', 403);
    const valid = await this.userService.verifyPassword(password, user);
    if (!valid) throw new RequestError('Invalid credentials', 401);
    const session = await this.userService.storeSession(user.id);
    return { token: session.token, user: this.userService.sanitizeUser(user) };
  }

  async googleLogin(idToken) {
    if (!idToken) {
      throw new RequestError('Google token missing');
    }
    const payload = await this.verifyGoogleToken(idToken);
    const googleId = payload.sub;
    const email = payload.email;
    if (!payload.email_verified) {
      throw new RequestError('Google email not verified', 403);
    }
    let user = await this.userService.getByEmail(email);
    if (user) {
      user.googleId = googleId;
      user.verified = true;
      await this.userService.updateUser(user);
    } else {
      user = await this.userService.createGoogleUser({
        email,
        googleId,
        displayName: payload.name || email,
      });
    }
    const session = await this.userService.storeSession(user.id);
    return { token: session.token, user: this.userService.sanitizeUser(user) };
  }

  async verifyGoogleToken(idToken) {
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
    if (!res.ok) {
      throw new RequestError('Failed to verify Google token', 401);
    }
    const data = await res.json();
    const audience = process.env.GOOGLE_CLIENT_ID;
    if (audience && data.aud !== audience) {
      throw new RequestError('Google client ID mismatch', 401);
    }
    return data;
  }

  async getSession(token) {
    return this.userService.getSession(token);
  }

  async logout(token) {
    return this.userService.deleteSession(token);
  }
}

module.exports = { AuthService };
