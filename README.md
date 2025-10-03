# Euro Arcade Platform

Euro Arcade is a full-stack web application that lets players purchase digital Euros using PayPal, store balances on verified accounts (email or Google), and access an expanding arcade hub. The project is designed to run without third-party packages so it can operate in locked-down environments.

## Features

- **Account system with verification** – Email registration triggers a verification message; Google Sign-In (via Google Identity Services) is supported when configured.
- **PayPal checkout** – Securely create and capture PayPal orders for Euro packs, with automatic balance updates and transaction history.
- **Euro wallet dashboard** – View current balance, past transactions, and purchase additional Euros with preset amounts.
- **Admin tools** – First verified account becomes an admin. Admins can search for users and manually adjust balances.
- **Arcade foundation** – Includes an extendable game catalog plus a playable "Euro Clicker" canvas mini-game.
- **Configurable email delivery** – Works out-of-the-box by writing messages to a local outbox; optionally connect to Mailgun for real emails.

## Project structure

```
backend/
  server.js               # HTTP server, API routing, static asset hosting
  services/               # Authentication, user, PayPal, email, and game services
  utils/                  # Helpers for env loading, JSON persistence, etc.
  data/                   # JSON files persisted at runtime (users, sessions, etc.)
frontend/
  index.html              # Single-page application shell
  verify.html             # Email verification landing page
  assets/                 # CSS and vanilla JS modules (API client, auth modal, arcade, etc.)
.env.example               # Sample environment configuration
```

All persistent information (users, sessions, transactions, emails) is stored as JSON under `backend/data/`.

## Prerequisites

- [Node.js 18+](https://nodejs.org/) – provides the runtime and built-in `fetch` API used by the backend.
- A PayPal developer account (sandbox credentials) for payment testing.
- Optional: Google Cloud project for OAuth Client ID, Mailgun account for SMTP-like email delivery.

## Configuration

1. Copy the sample environment file and adjust the values:
   ```bash
   cp .env.example .env
   ```
2. Edit `.env` and provide at least:
   - `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` (sandbox recommended while testing).
   - `GOOGLE_CLIENT_ID` (if you plan to enable Google login).
   - `MAILGUN_DOMAIN` / `MAILGUN_API_KEY` (only if you want real emails delivered).
   - Update `APP_URL` if you serve the app from a non-default host/port.

> **Tip:** Without Mailgun configuration the app will write verification emails into `backend/data/outbox/`. Each file contains the verification link that you can copy-paste into the browser.

## Running the project

1. Install dependencies (none are required beyond Node core modules).
2. Start the server:
   ```bash
   node backend/server.js
   ```
3. Open your browser to `http://localhost:3000`.

The same server hosts the API and the static frontend (`frontend/`).

## First-time setup flow

1. **Register a new account** from the landing page. The first verified account automatically receives the `admin` role.
2. **Verify the email**:
   - If Mailgun is configured, click the link delivered to your inbox.
   - Otherwise, open the `.html` file inside `backend/data/outbox/` and copy the verification link into your browser.
3. **Log in** with the verified account to access the dashboard and admin console.
4. **Configure PayPal sandbox**: in sandbox mode you can use PayPal test accounts to complete Euro purchases.
5. **(Optional) Google login**: once `GOOGLE_CLIENT_ID` is set, the login modal will show a Google Sign-In button powered by Google Identity Services.

## Admin guide

- Visit the **Admin** tab as an administrator to find users by email or ID and adjust their Euro balances.
- Transactions are visible under the **Dashboard** tab for each user.
- All data lives in JSON. If you need to back up or migrate, copy the `backend/data/` directory.

## Adding new games

1. Games are listed in `backend/data/games.json`. Each entry includes an `id`, `name`, `description`, and tags.
2. Extend the frontend by adding new game cards in `frontend/assets/js/ui.js` or building additional mini-games in the `assets/js` folder.
3. The included **Euro Clicker** demonstrates how to embed a canvas-based game module (`assets/js/clicker.js`).

## API overview

| Endpoint | Method | Description |
| --- | --- | --- |
| `/api/auth/register` | POST | Register with email/password. |
| `/api/auth/login` | POST | Authenticate with email/password. |
| `/api/auth/google` | POST | Verify Google ID token and log in. |
| `/api/auth/verify` | POST | Confirm email using the verification token. |
| `/api/auth/logout` | POST | Destroy the current session. |
| `/api/coins/balance` | GET | Retrieve the logged-in user's Euro balance. |
| `/api/coins/transactions` | GET | List the user's PayPal purchase history. |
| `/api/paypal/create-order` | POST | Create a PayPal order for the selected Euro amount. |
| `/api/paypal/capture-order` | POST | Capture an approved PayPal order and update balance. |
| `/api/games` | GET | Fetch the arcade catalog. |
| `/api/admin/users/find` | POST | Admin lookup by email or ID. |
| `/api/coins/update` | POST | Admin endpoint to set a user's balance. |

## Environment notes

- Emails are sent through Mailgun if configured. Otherwise verification messages are stored locally in `backend/data/outbox/`.
- PayPal API endpoints default to the sandbox base (`https://api-m.sandbox.paypal.com`). Switch to live by updating `PAYPAL_API_BASE`.
- JSON data stores make it easy to inspect and reset state during development. Deleting `backend/data/*.json` resets that portion of the data.

## Troubleshooting

- **PayPal errors**: ensure your sandbox credentials are correct and the server has network access to PayPal. Check server logs for details.
- **Google login failing**: verify the OAuth client ID matches the domain/port you are serving from (set in the Google Cloud Console). Errors surface in the browser console.
- **Email not received**: if Mailgun is unconfigured, look inside `backend/data/outbox/` for the message file. With Mailgun, confirm your domain is verified and API key is accurate.

Enjoy building on Euro Arcade! Contributions are welcome—extend the arcade catalog, add new payment packs, or integrate high-score leaderboards.
