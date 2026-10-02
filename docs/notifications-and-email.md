# Emails & Notifications

How Sachfitsin sends emails and shows in-app notifications.

---

## 1. Set up Resend (do this once)

You need to do these steps yourself. The code is already written and waits
for the API key.

| Step | What to do |
|---|---|
| 1 | Go to <https://resend.com> and create a free account. |
| 2 | Open **API Keys** → **Create API Key**. Give it `Sending access`. |
| 3 | Copy the key. It starts with `re_`. It is shown only once. |
| 4 | Paste it into `backend/.env` (see the table below). |
| 5 | Restart the Django server. |

That is enough to start sending. Emails will come from
`onboarding@resend.dev`, which Resend gives every account.

### Later: use your own domain

Sending from `@sachfitsin.com` looks more professional and lands in the
inbox more often.

| Step | What to do |
|---|---|
| 1 | In Resend open **Domains** → **Add Domain** → type `sachfitsin.com`. |
| 2 | Resend shows some DNS records (SPF, DKIM, and a return-path record). |
| 3 | Add those records at your domain provider (GoDaddy, Cloudflare, etc). |
| 4 | Wait for Resend to show **Verified**. This can take a few minutes to a few hours. |
| 5 | Change `DEFAULT_FROM_EMAIL` in `.env` to `Sachfitsin <hello@sachfitsin.com>`. |

**Free plan limits:** 100 emails a day, 3,000 a month. Enough for now.

---

## 2. Settings to add to `backend/.env`

Add these lines. Only the first one is required.

```
RESEND_API_KEY=re_your_key_here
DEFAULT_FROM_EMAIL=Sachfitsin <onboarding@resend.dev>
EMAIL_REPLY_TO=hello@sachfitsin.com
EMAIL_ENABLED=True
SUPPORT_EMAIL=hello@sachfitsin.com
SITE_NAME=Sachfitsin
```

| Setting | What it does | If you leave it out |
|---|---|---|
| `RESEND_API_KEY` | Your Resend key | No email is sent. Everything else still works. |
| `DEFAULT_FROM_EMAIL` | The "from" address | Uses `onboarding@resend.dev` |
| `EMAIL_REPLY_TO` | Where replies go | No reply-to header |
| `EMAIL_ENABLED` | Master on/off switch | `True` |
| `EMAIL_TIMEOUT_SECONDS` | How long to wait for Resend | 10 seconds |
| `SUPPORT_EMAIL` | Shown in the email footer | `hello@sachfitsin.com` |

**Nothing breaks without the key.** Emails are recorded as `SKIPPED` and the
app carries on. This is on purpose so you can develop without Resend.

---

## 3. Run the database migration

The new tables are `notifications_notification` and `notifications_emaillog`.

```bash
cd backend
./venv/bin/python manage.py migrate
```

---

## 4. Check it works

```bash
cd backend
./venv/bin/python manage.py send_test_email you@example.com
```

| Output | Meaning |
|---|---|
| `Sent to ...` | Working. Check your inbox. |
| `Skipped: RESEND_API_KEY is not set.` | Key missing from `.env`. |
| `FAILED: Resend returned 422 ...` | Resend rejected it. Usually the "from" address is not verified. |

You can also see every attempt in Django admin under
**Notifications & Email → Email logs**.

---

## 5. How it is built

```
Customer or dietician does something
          |
          v
   Django saves to the database        <- this must always succeed
          |
          v
   notifications/events.py             <- one function per event
          |
          +--> notification saved to the database  --> bell in the UI
          |
          +--> email sent through the Resend API   --> customer's inbox
```

### Files

| File | Job |
|---|---|
| `notifications/events.py` | One function per business event. **This is the only file other apps import.** |
| `notifications/email/client.py` | Talks to the Resend HTTP API. Nothing else. |
| `notifications/email/service.py` | Renders a template and sends it. Writes an `EmailLog` row. Never raises. |
| `notifications/services.py` | Creates in-app notifications. Never raises. |
| `notifications/models.py` | `Notification` and `EmailLog` tables. |
| `notifications/views.py` | The REST APIs. |
| `notifications/migrations/` | Run `migrate` after pulling changes here. |
| `notifications/templates/emails/` | The email designs. |

### Why no Celery or Redis

Emails are sent inside the request. For Sachfitsin's size that is fine and
it avoids running a queue, a worker and a Redis server.

The important part is the **order**: the business operation is saved first
and committed, then the email is attempted. If Resend is slow or down, the
diet plan is still saved and the customer still sees their in-app
notification.

If email volume grows later, only `email/service.py` needs to change — it
would push to a queue instead of calling `client.send` directly. Nothing
that calls `events.py` would have to change.

---

## 6. Emails that exist today

| Event | Template | When it fires |
|---|---|---|
| Sign-up | `welcome` | A customer registers |
| Appointment requested | `appointment_booked` | Customer books |
| Appointment confirmed | `appointment_confirmed` | Calendly confirms a slot |
| Appointment cancelled | `appointment_cancelled` | Calendly cancels |
| Diet plan created | `diet_plan_created` | Dietician creates a plan |
| Diet plan updated | `diet_plan_updated` | Dietician edits a plan |
| Video assigned | `personalized_video_assigned` | Dietician assigns a video |
| Exercise assigned | `exercise_assigned` | Dietician assigns an exercise |
| Subscription activated | `subscription_activated` | Dietician grants an entitlement |

### Adding a new email

1. Add a template in `notifications/templates/emails/`. Start it with
   `{% extends "emails/base.html" %}`.
2. Add a function to `notifications/events.py`. Decorate it with `@_safe`.
3. Call that function from the view, **after** `serializer.save()`.
4. Give it a `dedupe_key` so it cannot send twice.

---

## 7. Stopping duplicates

Two layers, because the same event can arrive twice (Calendly is polled
every few minutes, and a user can double-click a button).

| Layer | How it works |
|---|---|
| Database | `Notification` has a unique rule on `(user, dedupe_key)`. A second insert is rejected and quietly ignored. |
| Email log | Before sending, the service checks whether an email with the same `dedupe_key` was already `SENT`. |

A **failed** email does not block a retry with the same key. Only a
successful one does.

Dedupe keys look like `video-assigned:42`. Where a repeat is legitimate, the
key includes what changed — a rescheduled appointment uses
`appointment-confirmed:42:<new time>`, so a real reschedule notifies again
but a repeated sync does not.

---

## 8. Notification APIs

All of them need a logged-in user and only ever return that user's own rows.

| Method | Path | What it does |
|---|---|---|
| `GET` | `/api/v1/notifications/` | List. Supports `?unread=1`, `?category=VIDEO`, `?limit=20` (max 100). |
| `GET` | `/api/v1/notifications/unread-count/` | Just the badge number. |
| `POST` | `/api/v1/notifications/{id}/read/` | Mark one read. |
| `POST` | `/api/v1/notifications/read-all/` | Mark every unread one read. |
| `DELETE` | `/api/v1/notifications/{id}/` | Remove one. |

The list response:

```json
{
  "results": [ ... ],
  "unread_count": 4,
  "total": 12
}
```

---

## 9. The bell in the UI

`frontend/src/components/NotificationBell.tsx`. It sits in the header of
both the customer dashboard and the admin dashboard.

| Behaviour | Detail |
|---|---|
| Badge | Shows unread count, `99+` above 99 |
| Refresh | Polls every 60 seconds, and on window focus |
| Click a row | Marks it read and goes to its page |
| Mark all | One button, clears every unread |
| Delete | Hover a row, click the bin icon |

---

## 10. When something goes wrong

An email problem is **never** allowed to fail the request. Every failure is
written to `EmailLog` and to the log file.

| What happened | `EmailLog.status` | Did the business operation succeed? |
|---|---|---|
| Sent fine | `SENT` | Yes |
| Resend down or rejected it | `FAILED` | **Yes** |
| No API key, or `EMAIL_ENABLED=False` | `SKIPPED` | Yes |
| Already sent with the same key | `DUPLICATE` | Yes |
| Template has a bug | `FAILED` | Yes |

Where to look:

```bash
# Django logs, live
tail -f <your server log>            # look for "notifications.email"
```

Or Django admin → **Email logs** → filter by status `FAILED`.

---

## 11. Tests

```bash
cd backend
./venv/bin/python manage.py test notifications --settings=config.settings_test
```

`config/settings_test.py` uses an in-memory SQLite database and turns email
off, so **tests never touch the real database and never send real email**.

47 tests cover: template rendering, the Resend client, delivery failure,
duplicate prevention, every API endpoint, cross-user access, and the
end-to-end registration, diet-plan and entitlement flows.

---

## 12. Security notes

| Concern | How it is handled |
|---|---|
| Reading someone else's notifications | Every query is filtered by `request.user`. Tested. |
| Marking someone else's notification read | Returns 404, not 403 — it does not reveal that the row exists. Tested. |
| API key leaking into logs | Only the response body is stored, trimmed to 500 characters. Tested. |
| Huge responses | `limit` is capped at 100 rows. |
| Key in source control | It lives in `.env`, which is not committed. |
