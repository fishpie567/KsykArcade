const EMAIL_PROVIDER = process.env.EMAIL_PROVIDER || 'console';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const RESEND_API_BASE = 'https://api.resend.com';

async function sendEmail({ to, subject, html }) {
  if (!to) {
    throw new Error('Recipient email is required');
  }

  if (EMAIL_PROVIDER === 'resend') {
    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not configured');
    }

    const response = await fetch(`${RESEND_API_BASE}/emails`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || 'no-reply@example.com',
        to: [to],
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Resend API error: ${response.status} ${body}`);
    }
  } else {
    console.log('--- Outgoing Email (developer console) ---');
    console.log('To:', to);
    console.log('Subject:', subject);
    console.log('HTML:', html);
    console.log('-----------------------------------------');
  }
}

async function sendVerificationEmail({ to, verificationToken }) {
  const baseUrl = process.env.APP_BASE_URL || 'http://localhost:4000';
  const verifyUrl = `${baseUrl}/verify.html?token=${verificationToken}`;
  const subject = 'Verify your Euro Arcade account';
  const html = `
    <h1>Confirm your account</h1>
    <p>Thanks for creating an account at Euro Arcade! Click the button below to verify your email address.</p>
    <p><a href="${verifyUrl}" style="display:inline-block;padding:12px 16px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px">Verify email</a></p>
    <p>If you didn't create an account, you can safely ignore this email.</p>
  `;
  await sendEmail({ to, subject, html });
}

module.exports = {
  sendEmail,
  sendVerificationEmail,
};
