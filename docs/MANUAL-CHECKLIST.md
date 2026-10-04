# Manual checklist

Everything that needs a person: settings to add, accounts to create, and checks that automated
tests cannot do. Covers both repos. Tick items off here as they are done.

**Last updated:** 2026-10-04

---

## 1. Vercel environment variables — do now

### Backend project (Settings → Environment Variables)

Values are in `campus_cure_backend/.env` on the machine that generated them. Copy them; do not
regenerate the ones marked **never change**.

| Variable | Feature | Notes |
|---|---|---|
| `GROQ_API_KEY2` | CC-50 image doubts, AI fallback | Without it, image doubts do not work in production |
| `MFA_ENCRYPTION_KEY` | CC-62 two-step login | Can be a fresh `openssl rand -base64 32` for production, but **never change it once anyone has enrolled**, or their 2FA stops working |
| `VAPID_PUBLIC_KEY` | CC-41 push | **Never change.** Every browser subscription is tied to it |
| `VAPID_PRIVATE_KEY` | CC-41 push | Same pair as above |
| `VAPID_SUBJECT` | CC-41 push | `https://campus-cure-frontend.vercel.app` |
| `RESEND_API_KEY` | CC-03 email | Already available; see section 2 for what works without a domain |
| `EMAIL_REDIRECT_TO` | CC-03 safety catch | **Keep it set** to the Resend account owner's address until a domain exists (section 2) |

After adding them: **Redeploy** the backend (env changes only apply to new deployments).

### Frontend project

Nothing new is required. `VITE_SENTRY_DSN` stays empty until section 3.

- [ ] Backend variables added
- [ ] Backend redeployed
- [ ] Frontend redeployed (for the service worker, Hindi and the new login page)

---

## 2. Email without a domain — current limits

Resend only lets an account **without a verified domain** send from `onboarding@resend.dev`, and
**only to the account owner's own email address**. A `*.vercel.app` address cannot be verified,
because Vercel owns its DNS.

What that means today:

| Feature | Status without a domain |
|---|---|
| CC-40 email notifications | Delivered only to the owner's inbox (via `EMAIL_REDIRECT_TO`). Fine for a demo |
| CC-63 sign-in by email code | **Stays off, by design.** With a redirect, one inbox would receive everyone's codes and could sign in as anyone. The login page hides the option |
| CC-41 browser push | **Works**, needs no domain |
| CC-42 Telegram | **Works** once a bot token is set (section 4), needs no domain |

When a domain is bought (any registrar; a `.in` or `.xyz` is usually cheap):

- [ ] Resend → Domains → Add Domain → add the shown DNS records (SPF, DKIM) at the registrar
- [ ] Wait for "Verified"
- [ ] Set `EMAIL_FROM` = `CampusCure <no-reply@your-domain>` in Vercel
- [ ] Read the notification emails once (CC-40), then **remove** `EMAIL_REDIRECT_TO`
- [ ] Redeploy, then check the login page offers "Email me a sign-in code"

---

## 3. Sentry — deferred

Error tracking (CC-05) is built and stays off until a DSN is set. Nothing breaks without it;
errors still go to the Vercel function logs.

- [ ] sentry.io → Create Project → **Node.js** → copy DSN into backend `SENTRY_DSN`
- [ ] Create a second project → **React** → copy DSN into frontend `VITE_SENTRY_DSN`
- [ ] Redeploy both

---

## 4. Telegram

Done locally on 2026-10-04: bot `@campuscure_bot` verified, a webhook secret generated, and the
webhook **registered with Telegram** at `https://campus-cure-backend.vercel.app/api/telegram/webhook`.
Until production has the variables below, Telegram's calls to that URL fail and linking cannot
complete.

- [ ] Add to the backend in Vercel, copied from `.env`: `TELEGRAM_BOT_TOKEN`,
      `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET` (**must match exactly**: Telegram sends it
      with every call, and a mismatch answers 401)
- [ ] Redeploy the backend and the frontend
- [ ] Profile → **Telegram → Connect Telegram → Open Telegram → Start** → the card switches to
      "Connected" by itself
- [ ] Trigger a notification (assign a complaint to that user) → it arrives in Telegram with a link
      back to the app
- [ ] If the secret ever changes, re-register the webhook (`setWebhook` with the new
      `secret_token`); see `.env.example`

---

## 5. Checks in a real browser

Automated tests cover the logic; these need a human, a camera or a phone.

### Two-step verification (CC-62)
- [ ] Profile → **Set up two-step verification** → scan the QR with Google/Microsoft Authenticator
- [ ] Enter the code → save the 10 recovery codes
- [ ] Log out → log in → asked for the code → works
- [ ] Log in once with a recovery code → warning shows how many are left
- [ ] Turn it off again (needs password + code)
- [ ] As **super admin**: Users → a user with 2FA → **Reset two-step verification** works, and an
      ordinary admin does not see the button

### Browser notifications (CC-41) — production build only
- [ ] Profile → **Browser notifications → Turn on** → allow in the browser prompt
- [ ] Trigger a notification (assign a complaint to that user) → alert appears with CampusCure closed
- [ ] Click it → opens the right page
- [ ] Log out → no further alerts on that device
- [ ] On iPhone: only works after **Share → Add to Home Screen**, then opening from the icon

### Installable app and offline (CC-70)
- [ ] Chrome/Edge → address bar → **Install** → opens in its own window with the CampusCure icon
- [ ] Open a few doubts and My Complaints → DevTools → Network → **Offline** → reload → they still
      show, with the yellow "You are offline" banner
- [ ] Log out → offline, the previous user's complaints are no longer readable

### Hindi (CC-71)
- [ ] Switch to **हिंदी** on the login page → sign in → sidebar, Raise Complaint, My Complaints and
      the staff complaint queue are in Hindi
- [ ] **Have a Hindi-speaking member of staff read those screens** and note awkward wording

### Inline images and attachments (CC-23 / CC-24)
- [ ] Ask a doubt → image button in the editor → photo appears in the text → post → visible to others
- [ ] Answer with an inline image; attach a PDF in the tray; both show once, not twice
- [ ] Edit that doubt → the image is still there

### Image doubts (CC-50)
- [ ] After adding `GROQ_API_KEY2` in Vercel: Ask a doubt from a photo of a handwritten question →
      form fills in → edit → post
- [ ] Note: the free Groq tier allows about 3 photos a minute in total

### Complaint photos (CC-30)
- [ ] On a phone with location on: raise a complaint with a photo → download it back →
      `exiftool -gps:all photo.jpg` prints nothing

### Answer moderation (fixed 2026-10-04)
Faculty could not approve or reject student answers in production: the route ran the wrong handler
(see CC-72). After deploying:
- [ ] As faculty: a pending student answer → **Approve** → it becomes visible to students
- [ ] **Reject** an approved answer → the author's reputation drops by the approval points

### Faculty performance (CC-26)
- [ ] As admin: **Faculty Performance** → click a row → detail opens
- [ ] As super admin: **Audit log** shows a `faculty.stats_view` entry for that click

---

## 6. Data repair — vote counts (your decision)

Fixed in code on 2026-10-04: votes on an answer were also added to the doubt's own upvote count, so
the "Upvote this doubt" button showed an inflated number. Separately, the demo seed wrote random vote
counts with **no vote rows** behind them; it now creates real votes.

Stored counts are still out of step: on 2026-10-04, 48 of 56 doubts and 19 of 22 answers. Most of
that is seed data, so fixing it sets most demo counts to their real value, usually 0.

- [ ] See the current state (changes nothing):
      `npx tsx src/scripts/reconcileCounters.ts`
- [ ] Either reseed the demo data first (`npx tsx src/scripts/seedDemoData.ts`), or accept lower
      numbers, then fix: `npx tsx src/scripts/reconcileCounters.ts --apply`

## 7. Not built yet

See the "Remaining" section of [ROADMAP.md](ROADMAP.md).
