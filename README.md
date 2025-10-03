# Euro Arcade

Euro Arcade is a self-contained full-stack web application that lets players purchase digital "Euro" coins via PayPal, manage their balance, and jump into a growing library of arcade-style mini games. It includes email-based account verification, optional Google sign-in, an admin dashboard for balance management, and a gorgeous glassmorphism-inspired interface.

## ✨ Features

- **User accounts** with email/password registration, verification links, and optional Google sign-in.
- **Secure wallet** that tracks each player's Euro balance and recent transactions.
- **PayPal checkout** integration (sandbox or live) for purchasing digital coins.
- **Admin controls** to inspect users and adjust balances.
- **Built-in mini games** (Coin Clicker and Memory Match) as a foundation for a full arcade.
- **Zero external runtime dependencies** – the Node.js backend uses only core modules so it can run in locked-down environments.
- **Static frontend** served by the backend with modern styling and responsive layouts.

## 🗂️ Project structure

```
KsykArcade/
├── client/              # Frontend HTML, CSS, JS and mini games
│   ├── index.html
│   ├── app.js
│   ├── styles.css
│   └── verify.html
├── server/              # Node.js backend (no third-party packages required)
│   ├── data/
│   │   └── database.json
│   ├── services/
│   │   ├── emailService.js
│   │   └── paypalService.js
│   ├── utils/
│   │   ├── db.js
│   │   └── security.js
│   └── index.js
└── .env.example         # Template for configuration
```

## 🚀 Quick start

1. **Install Node.js 18 or newer.** The backend uses the built-in `fetch` API that ships with Node 18+.
2. **Clone the repository** and copy `.env.example` to `.env`:

   ```bash
   cp .env.example .env
   ```

3. **Fill in the environment variables** (see [Configuration](#-configuration)).
4. **Start the server** from the project root:

   ```bash
   node server/index.js
   ```

5. Open <http://localhost:4000> in your browser. The backend serves both the API and the frontend UI.

## ⚙️ Configuration

All settings are supplied through environment variables. The `.env` file is read by your shell before starting the app (for example by running `export $(cat .env | xargs)` on Linux/macOS or using `set` on Windows PowerShell).

| Variable | Required | Description |
| --- | --- | --- |
| `PORT` | No | Port for the Node.js server (defaults to `4000`). |
| `JWT_SECRET` | Yes | Secret string used to sign session tokens. Pick a long random value in production. |
| `APP_BASE_URL` | Yes | Public base URL of the application. Used to build email verification links. |
| `EMAIL_PROVIDER` | No | Set to `console` (default) to log emails to the server console, or `resend` to send real messages via the [Resend](https://resend.com) API. |
| `RESEND_API_KEY` | Required when `EMAIL_PROVIDER=resend` | Your Resend API key. |
| `RESEND_FROM` | Required when `EMAIL_PROVIDER=resend` | From address used in transactional emails. |
| `PAYPAL_MODE` | Yes | `sandbox` for testing or `live` for production. |
| `PAYPAL_CLIENT_ID` | Yes | PayPal REST client ID. |
| `PAYPAL_CLIENT_SECRET` | Yes | PayPal REST client secret. |
| `GOOGLE_CLIENT_ID` | Optional | Enables one-tap Google sign-in when provided. |

### Loading environment variables

On Linux/macOS you can load your `.env` file before launching the server:

```bash
export $(grep -v '^#' .env | xargs)
node server/index.js
```

On Windows PowerShell:

```powershell
Get-Content .env | Foreach-Object {
  if ($_ -and $_ -notmatch '^#') {
    $pair = $_.Split('=')
    [Environment]::SetEnvironmentVariable($pair[0], $pair[1])
  }
}
node server/index.js
```

## 💳 PayPal integration

1. Create a PayPal developer account and generate REST API credentials.
2. Copy the client ID and secret into your `.env` file.
3. Update the PayPal script tag near the top of `client/index.html` with your client ID:

   ```html
   <script src="https://www.paypal.com/sdk/js?client-id=YOUR_CLIENT_ID&currency=EUR" async defer></script>
   ```

4. Restart the server so the new environment variables take effect.
5. When a player approves a payment, the backend captures the order, records the transaction, and credits the user balance.

## 📧 Email verification

- By default, emails are logged to the server console (handy for local development).
- To send real emails, sign up for Resend (or adapt `server/services/emailService.js` to your provider) and set `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, and `RESEND_FROM`.
- Verification links direct users to `/verify.html?token=...`, which calls the backend to mark the email as verified.

## 🔐 Authentication flow

- **Email/password** registrations store PBKDF2-hashed passwords inside `server/data/database.json` (a simple JSON datastore ideal for demos).
- **Google sign-in** uses the [Google Identity Services](https://developers.google.com/identity/gsi/web) script. The frontend sends the ID token to `/api/auth/google`, which verifies it against Google and creates or updates the account.
- Successful sign-ins return a JWT stored in `localStorage` and attached to subsequent API requests.

## 🛠️ Admin dashboard

The first account that registers is automatically marked as an admin. Admins can:

- View all users and their balances.
- Update balances directly from the web UI.

You can manually grant admin privileges by editing `server/data/database.json` and setting `"isAdmin": true` for the desired user (restart the server afterwards).

## 🎮 Arcade games

Two mini games are included to demonstrate the arcade shell:

- **Coin Clicker** – click floating Euro coins before they fade away.
- **Memory Match** – flip cards to find symbol pairs.

New games can be added by extending the HTML markup inside `client/index.html` and appending modules to `client/app.js`.

## 🧪 Testing notes

Automated tests are not bundled due to the zero-dependency requirement. You can manually verify core flows by:

1. Registering a new account and using the console log to retrieve the verification link.
2. Logging in, purchasing Euros via the PayPal sandbox, and confirming the balance increment.
3. Creating a second account and adjusting its balance via the admin dashboard.

## 📦 Persistence

User accounts and transactions are stored in `server/data/database.json`. For production deployments, replace this layer with your preferred database by editing `server/utils/db.js` and related helpers.

## 📝 License

This project is provided as-is for demonstration purposes. Customize it freely for your arcade empire!
