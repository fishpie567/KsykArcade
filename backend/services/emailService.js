const fs = require('fs');
const path = require('path');

const OUTBOX_DIR = path.resolve(__dirname, '..', 'data', 'outbox');
if (!fs.existsSync(OUTBOX_DIR)) {
  fs.mkdirSync(OUTBOX_DIR, { recursive: true });
}

async function sendEmail({ to, subject, html }) {
  if (!to) throw new Error('Recipient missing');
  if (process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN) {
    await sendViaMailgun({ to, subject, html });
    return;
  }
  const file = path.join(OUTBOX_DIR, `${Date.now()}-${sanitize(to)}.html`);
  const content = `To: ${to}\nSubject: ${subject}\n\n${html}`;
  await fs.promises.writeFile(file, content, 'utf-8');
  console.log(`Email written to ${file}`);
}

function sanitize(value) {
  return value.replace(/[^a-z0-9@.]/gi, '_');
}

async function sendViaMailgun({ to, subject, html }) {
  const domain = process.env.MAILGUN_DOMAIN;
  const key = process.env.MAILGUN_API_KEY;
  const url = `https://api.mailgun.net/v3/${domain}/messages`;
  const params = new URLSearchParams();
  params.append('from', process.env.MAIL_FROM || `Euro Arcade <mailgun@${domain}>`);
  params.append('to', to);
  params.append('subject', subject);
  params.append('html', html);

  const auth = Buffer.from(`api:${key}`).toString('base64');
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to send email: ${text}`);
  }
}

module.exports = { sendEmail };
