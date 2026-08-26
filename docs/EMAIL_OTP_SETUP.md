# Setting up verification codes

This is the step-by-step for switching WatchSphere from "codes are only written
to the log" to "codes actually arrive in the dealer's inbox".

No coding required. Budget about 20 minutes, plus waiting time for DNS records
to propagate (usually minutes, occasionally a few hours).

---

## What you are setting up, in plain terms

When a dealer signs up, or logs in without a password, we send them a 6-digit
code. That code goes to their **email address**. WatchSphere does not run a
mail server — a company called **Postmark** sends it for us. You create a
Postmark account, verify that you own `watchsphere.io`, and paste one value
into Railway.

The dealer's **WhatsApp number is still mandatory** at signup, and it is what
they type to log in without a password — but nothing is ever sent to it. It is
how dealers reach each other, not a delivery channel.

**Cost:** Postmark's free tier covers 100 emails/month; paid plans start around
$15/month for 10,000. You only pay for what you send.

---

## Step 1 — Create the Postmark account

1. Go to <https://postmarkapp.com> and sign up.
2. Postmark starts you in a **sandbox** server, which can only send to
   addresses you have verified. That is fine for testing, but codes will not
   reach real dealers until you leave it — see Step 4.

## Step 2 — Verify the sending domain

1. In Postmark, open **Sender Signatures** → **Add Domain**.
2. Enter `watchsphere.io`.
3. Postmark shows you a **DKIM** record and a **Return-Path** record. Add both
   to the DNS for `watchsphere.io` at your registrar.
4. Click **Verify**. This is what lets mail leave as `noreply@watchsphere.io`
   without landing in spam.

Verify the domain rather than a single address — otherwise every address you
ever send from has to be confirmed by clicking a link in its own inbox.

## Step 3 — Copy the Server API token

1. Open your Postmark **server** → **API Tokens**.
2. Copy the **Server API token**. It is not the Account token; the account
   token cannot send mail.

## Step 4 — Leave sandbox mode

Request approval from Postmark to send to arbitrary recipients. They usually
ask what the mail is for — "transactional one-time login codes for a watch
trading platform" is the honest and sufficient answer. Until this is approved,
signup will silently fail for anyone whose address you have not verified.

## Step 5 — Paste it into Railway

In the Railway project for the backend, set:

| Variable | Value |
|---|---|
| `POSTMARK_API_KEY` | the Server API token from Step 3 |
| `EMAIL_FROM` | `noreply@watchsphere.io` |
| `EMAIL_FROM_NAME` | `WatchSphere` |

Railway redeploys on save. Nothing needs rebuilding in the mobile or web apps —
the code delivery channel lives entirely on the backend.

Optional, both have working defaults:

| Variable | Default | Meaning |
|---|---|---|
| `EMAIL_OTP_EXPIRY_MINUTES` | `10` | how long a code stays valid |
| `EMAIL_OTP_RESEND_COOLDOWN_SECONDS` | `60` | minimum gap between requests |

**Leave the cooldown at 60.** The mobile and web apps hardcode a matching 60
second countdown, so changing it here makes the on-screen timer wrong until
both apps are rebuilt.

---

## Checking it works

1. Sign up with an address you can read.
2. The code should arrive within a few seconds. If it does not, open Postmark's
   **Activity** tab — every attempt is listed there with its outcome.

Common failures:

- **Nothing in Activity at all** — `POSTMARK_API_KEY` is missing or wrong on
  Railway. The backend logs the failure and returns success to the caller
  regardless, so the app will look like it worked.
- **"Recipient not allowed"** — still in sandbox mode. See Step 4.
- **Sent, but not delivered** — the DKIM or Return-Path record has not
  propagated yet, or the address bounced. Both show in Activity.

## In development

With `ENVIRONMENT=development` and no `POSTMARK_API_KEY` set, no mail is sent
at all — the code is printed to the backend log instead:

```
[DEV] Verification email to dealer@example.com: Code is 123456
```

That is the intended local setup. Do not put a real Postmark key in a local
`.env` unless you specifically want to test delivery.
