# Setting up WhatsApp verification codes

This is the step-by-step for switching WatchSphere from "codes are only written
to the log" to "codes actually arrive on the dealer's WhatsApp".

No coding required. Budget about 30–60 minutes, plus waiting time for Meta to
approve the WhatsApp sender (usually same day, occasionally a couple of days).

---

## What you are setting up, in plain terms

When a dealer signs up or logs in, we need to send them a 6-digit code on
WhatsApp. WatchSphere does not talk to WhatsApp directly — a company called
**Twilio** does it for us. You create a Twilio account, connect your WhatsApp
sender, and paste three values into Railway. That's it.

**Cost:** about **$0.05–0.07 per code sent**. 100 signups ≈ $6/month. You only
pay when a message is actually delivered. There is a small free trial credit to
test with, but no ongoing free plan.

---

## Step 1 — Create the Twilio account

1. Go to **https://www.twilio.com/try-twilio**
2. Sign up with your work email and confirm it.
3. Verify your own mobile number when asked (Twilio sends you a code).
4. When it asks what you want to do, you can pick "Verify users" / "OTP".
   The answers only tailor their tips — nothing breaks if you choose otherwise.

You are now on a **trial account**. A trial can only send messages to numbers
you have personally verified, which is fine for testing and useless for real
dealers. Step 5 covers upgrading.

---

## Step 2 — Connect a WhatsApp sender

1. In the Twilio Console left menu, open **Messaging → Senders → WhatsApp senders**.
2. Click **Create new sender** and follow the prompts.
   - You will need a **Meta / Facebook Business account**. If you don't have
     one, Twilio walks you through creating it.
   - You will need a **phone number that is NOT already in use on WhatsApp**.
     If the number already has a normal WhatsApp or WhatsApp Business account,
     delete that account first or use a different number.
3. Submit for approval and wait. Meta reviews the sender. Status becomes
   **Connected / Approved** when it's done.

> **You do not need to write or submit any message templates.** Twilio creates
> the verification-code templates automatically. This is the main reason we
> chose this option — template approval is normally the slow, painful part.

While you wait, you can keep testing with the **Twilio Sandbox** (Messaging →
Try it out → Send a WhatsApp message). The sandbox only messages people who
have opted in by sending a join code, so it is for your own testing only.

---

## Step 3 — Create a Verify Service

1. In the Console left menu, open **Verify → Services**.
2. Click **Create new Service**.
3. **Friendly name:** type `WatchSphere`. This name appears in the message the
   dealer receives, so spell it exactly how you want them to see it.
4. Save it.
5. On the service page, enable **WhatsApp** as a channel and select the sender
   you connected in Step 2.
6. Copy the **Service SID**. It is a long string starting with `VA`.

---

## Step 4 — Collect your three values

From the Twilio Console **home/dashboard** page:

| What to copy | Looks like | Where to find it |
|---|---|---|
| **Account SID** | `ACxxxxxxxx…` | Console dashboard, "Account Info" |
| **Auth Token** | a long secret | Same panel — click **Show** to reveal |
| **Verify Service SID** | `VAxxxxxxxx…` | Verify → Services → your service |

> Treat the **Auth Token** like a password. Do not put it in email, chat,
> screenshots, or anywhere in the code. It only ever goes into Railway.

---

## Step 5 — Upgrade from trial (before real dealers use it)

On a trial account you can only message numbers you have manually verified, so
real signups will fail. In the Console click **Upgrade** and add billing
details. Adding ~$20 of credit is plenty to start.

---

## Step 6 — Put the values into Railway

1. Open **https://railway.app** and go to the WatchSphere **backend** service.
2. Open the **Variables** tab.
3. Add these four variables:

```
WHATSAPP_OTP_DRIVER       = twilio_verify
TWILIO_ACCOUNT_SID        = AC…   (from Step 4)
TWILIO_AUTH_TOKEN         = …     (from Step 4)
TWILIO_VERIFY_SERVICE_SID = VA…   (from Step 3)
```

4. Save. Railway redeploys automatically — takes a minute or two.

That's it. Codes now go out over WhatsApp.

---

## Step 7 — Check that it works

1. Open the app and start a signup with a **real WhatsApp number you can read**.
2. The code should arrive within a few seconds, from your approved sender.
3. Enter it. You should land in the app.

If nothing arrives, see the table below.

---

## If something goes wrong

| Symptom | Most likely cause |
|---|---|
| No message at all, app shows no error | `WHATSAPP_OTP_DRIVER` is still `log`. Codes are being written to the Railway logs instead of sent. |
| Works for your number only | Account is still on **trial**. Upgrade (Step 5). |
| "Invalid or expired code" for a correct code | Code is older than 10 minutes, or already used once. Request a new one. |
| Nothing arrives for anyone, errors in Railway logs | One of the three values is wrong, or the WhatsApp sender is not approved yet. |
| "Please wait N seconds" | Working as intended — one code per number per 60 seconds. |

To read the logs: Railway → backend service → **Deployments** → **View logs**,
and look for lines mentioning `Twilio Verify` or `whatsapp`.

---

## Switching it off again

Set `WHATSAPP_OTP_DRIVER = log` in Railway. Codes stop being sent and are only
written to the logs. Useful for staging, and it costs nothing.

---

## The other options (for reference)

`WHATSAPP_OTP_DRIVER` also accepts:

- **`whapi`** — whapi.cloud, ~$29/month flat. Cheaper at high volume and quick
  to set up, but it works by pairing a real WhatsApp account in a way WhatsApp
  does not officially permit. That account can be banned without warning, and
  since it would be gating login, a ban locks every dealer out. Not recommended
  for authentication.
- **`twilio`** — plain Twilio WhatsApp messaging. Needs you to write and get a
  message template approved yourself. `twilio_verify` avoids that work.
