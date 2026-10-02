# Deployment — Render + Neon

Written for whoever deploys Sachfitsin. Follow it in order. Several steps
depend on earlier ones.

---

## The stack

| Part | Where | Notes |
|---|---|---|
| React frontend | Render Static Site | `sachfitsin.com` |
| Django backend | Render Web Service | `api.sachfitsin.com` |
| Postgres | Neon | Not Render's database |
| Email | Resend | HTTP API, not SMTP |
| Payments | Razorpay | |
| Appointments | Calendly | |
| Videos | YouTube | Links only, nothing hosted |

### File uploads are not part of V1

There is **no file upload anywhere in the app**. Every image and video is
a URL that the dietician pastes in:

| Model | Field |
|---|---|
| `content.Article` | `cover_image_url` |
| `videos.Video` | `thumbnail_url`, `video_url` |
| `exercises.Exercise` | `image_url`, `video_url` |

There are zero `FileField` and zero `ImageField` in the whole backend. So
**Cloudflare R2 has nothing to store yet.** Setting it up now gives you an
empty bucket and two more secrets to manage.

Leave it out of V1. Add it on the day you want real uploads — that is a
feature (model fields, admin widgets, `django-storages`, `boto3`), not a
deploy step.

---

## Order matters — but not for the reason you might expect

You were right that order matters. The reason is smaller and better than
expected.

**No `settings.py` changes are left to make.** Every host-dependent value
already reads from an environment variable:

| Setting | Comes from |
|---|---|
| `ALLOWED_HOSTS` | `FRONTEND_URL` host + `ALLOWED_HOSTS` |
| `CORS_ALLOWED_ORIGINS` | `CORS_ALLOWED_ORIGINS`, defaults to `FRONTEND_URL` |
| `CSRF_TRUSTED_ORIGINS` | Copied from `CORS_ALLOWED_ORIGINS` |
| `DATABASES` | `DATABASE_URL` |

So nothing was written blind. What depends on the Render URLs is only the
**values** you type into Render's dashboard.

And because you already own `sachfitsin.com`, you can decide every value
up front instead of waiting for Render to hand you a URL. That removes the
circular wait: the backend needs the frontend URL, and the frontend needs
the backend URL.

Decide these two now and nothing has to be revisited:

| Variable | Value |
|---|---|
| Frontend | `https://sachfitsin.com` |
| Backend | `https://api.sachfitsin.com` |

### The sequence

| # | Step | Why here |
|---|---|---|
| 1 | Neon database | Nothing depends on it; it depends on nothing |
| 2 | Backend Web Service | Needs `DATABASE_URL` from step 1 |
| 3 | DNS for `api.sachfitsin.com` | Needs the Render service to exist |
| 4 | Frontend Static Site | `VITE_API_BASE_URL` is baked in at build time |
| 5 | DNS for `sachfitsin.com` | Needs the static site to exist |
| 6 | Webhooks | Need a public HTTPS backend URL |
| 7 | HSTS | Only once HTTPS works on both domains |

---

## Before you start

| Check | Command |
|---|---|
| Tests pass | `cd backend && ./venv/bin/python manage.py test --settings=config.settings_test` |
| Production checks pass | `DEBUG=False SECURE_HSTS_SECONDS=31536000 ./venv/bin/python manage.py check --deploy` |
| Frontend builds | `cd frontend && npm run build` |
| Nothing secret is staged | `git status --short` — `.env` and `venv/` must NOT appear |

All four must be clean. The last one matters most: a committed `.env` is
public forever, even after you delete it.

---

## 1. Neon database

### Pick the right connection string

Neon gives you two. They are not interchangeable.

| String | Hostname | Use it for |
|---|---|---|
| Direct | `ep-xxx.region.aws.neon.tech` | **This app** |
| Pooled | `ep-xxx-pooler.region.aws.neon.tech` | Serverless functions |

Use the **direct** one. Render runs a long-lived gunicorn process with 2
workers, so it holds about 2 connections — nowhere near needing a pooler.
The pooled endpoint runs PgBouncer in transaction mode, which quietly
breaks session-level Postgres features Django uses.

Keep `?sslmode=require` on the end. Neon includes it already.

### Neon sleeps, and the app now survives it

Neon's free plan suspends the compute after about 5 minutes with no
queries, and closes every open connection when it does.

Django holds connections open for 600 seconds. Without help it would reuse
a connection Neon already killed, and the first visitor after a quiet spell
would get a 500:

```
OperationalError: terminating connection due to administrator command
```

This is already handled. `config/settings.py` sets:

```python
conn_health_checks=True
```

Django now checks the connection is alive before using it and reconnects if
it is gone. An idle connection does not keep a Neon compute awake, so this
costs you no compute hours.

What you will still notice: the **first** request after a quiet spell takes
a second or two longer while Neon wakes up. That is normal.

---

## 2. Backend — Render Web Service

### Service settings

| Field | Value |
|---|---|
| Environment | Python 3 |
| **Root Directory** | `backend` |
| Build Command | see below |
| Start Command | see below |
| Health Check Path | `/api/v1/health/` |

**Root Directory is easy to miss.** The repo has `backend/` and
`frontend/` side by side. Leave it blank and Render looks for
`requirements.txt` at the repo root, finds nothing, and fails.

The health path must be `/api/v1/health/` with the trailing slash.
`/api/v1/` itself is a 404 — there is no index view there — and Render
would mark every deploy unhealthy while the site worked fine in a browser.

### Build Command

```bash
pip install -r requirements.txt && python manage.py collectstatic --noinput && python manage.py migrate --noinput
```

### Start Command

```bash
gunicorn config.wsgi --bind 0.0.0.0:$PORT --workers 2 --timeout 60 --access-logfile -
```

This is the same line as `backend/Procfile`. Paste it into the dashboard
anyway — the dashboard field is the path Render documents, and it is
visible where you are already working.

### Why `migrate` is in the Build Command

**Render does not run a Procfile `release:` line.** That is Heroku's
feature. An earlier version of this file told you otherwise; it was wrong,
and the `release:` line has been removed from the Procfile so it cannot
mislead anyone.

On Render the options are:

| Plan | Where migrations go |
|---|---|
| Free | Build Command (above) |
| Paid | Pre-Deploy Command — cleaner, but paid services only |

Move it to Pre-Deploy if you upgrade. Until then the Build Command is
correct and works.

One thing to know: the build runs while the old version is still serving
traffic. Adding tables and columns is safe. Dropping or renaming one would
break the running version for a few seconds — so for any destructive
migration, deploy it on its own.

### Why 2 workers and not 3

Render's Free and Starter instances have 512 MB of RAM. Each Django
gunicorn worker uses roughly 120–180 MB. Three workers can reach 540 MB and
get killed. Two fit with room to spare.

Raise it when you move to a 2 GB instance.

### The free plan spins down

| Behaviour | Effect |
|---|---|
| No request for 15 minutes | Service sleeps |
| Next request | Takes 30–60 seconds |

What that costs you:

- The first visitor after a quiet night waits up to a minute.
- A Razorpay webhook can time out. Razorpay retries, so access is still
  granted — just later.
- Calendly webhooks behave the same way.

The only supported fix is a paid instance. For a live business taking
payments, the Starter plan is worth it.

### Environment variables — required

The server will not boot without these.

| Variable | Value |
|---|---|
| `SECRET_KEY` | Fresh, 50+ characters. **Not** your local one |
| `DATABASE_URL` | Neon direct string from step 1 |
| `FRONTEND_URL` | `https://sachfitsin.com` |
| `RAZORPAY_KEY_ID` | |
| `RAZORPAY_KEY_SECRET` | |
| `CALENDLY_ACCESS_TOKEN` | |

Generate the secret key:

```bash
python -c "from django.core.management.utils import get_random_secret_key as k; print(k())"
```

Production refuses to start if `SECRET_KEY` is missing or under 40
characters. That is deliberate — a weak key lets anyone forge a session.

### Environment variables — have defaults, but set them anyway

| Variable | Value | If you skip it |
|---|---|---|
| `DEBUG` | `False` | **Stack traces, including settings values, shown to anyone who triggers an error** |
| `ALLOWED_HOSTS` | `api.sachfitsin.com,sachfitsin-api.onrender.com` | See the note below |
| `RAZORPAY_WEBHOOK_SECRET` | From the Razorpay dashboard | Every webhook rejected; a customer who closes the tab pays and gets nothing |
| `RESEND_API_KEY` | From Resend | No email is ever sent |
| `CALENDLY_WEBHOOK_SIGNING_KEY` | From Calendly | Appointment confirmations never arrive |
| `CALENDLY_SYNC_SECRET` | Any long random string | The sync endpoint refuses every call |

**`ALLOWED_HOSTS` needs the `.onrender.com` hostname too, not just your
custom domain.** Render's health checks and internal routing arrive with
the `.onrender.com` Host header. Leave it out and health checks get a 400
and Render marks the deploy unhealthy — while the site looks fine in your
browser.

`DEBUG` is the one to be careful with. The settings refuse a weak
`SECRET_KEY`, but nothing forces `DEBUG=False`. That is on you.

### Optional

`SITE_NAME`, `SUPPORT_EMAIL`, `DEFAULT_FROM_EMAIL`, `EMAIL_REPLY_TO`,
`EMAIL_ENABLED`, `EMAIL_TIMEOUT_SECONDS`, `DB_CONN_MAX_AGE`, `THROTTLE_*`,
`API_LOG_LEVEL`, `NOTIFICATIONS_LOG_LEVEL`, `SECURE_SSL_REDIRECT`,
`SECURE_HSTS_SECONDS`, `CORS_ALLOWED_ORIGINS`.

`CORS_ALLOWED_ORIGINS` defaults to `FRONTEND_URL`, which is right here. Set
it only if you need more than one origin.

Full list with explanations: [`backend/.env.example`](../backend/.env.example).

### After the first deploy

Use Render's **Shell** tab:

```bash
python manage.py createsuperuser
```

Then open `/admin/`, find that user, and set **role = DIETICIAN**. New
users default to CUSTOMER, so without this you cannot reach the dietician
panel.

---

## 3. DNS for the backend

In Render → your service → **Settings → Custom Domains**, add
`api.sachfitsin.com`. Render shows the DNS record to create.

| Record | Name | Value |
|---|---|---|
| CNAME | `api` | the `.onrender.com` hostname Render gives you |

Wait for Render to show the certificate as issued before moving on. The
frontend build in the next step points at this domain.

---

## 4. Frontend — Render Static Site

| Field | Value |
|---|---|
| **Root Directory** | `frontend` |
| Build Command | `npm install && npm run build` |
| Publish Directory | `dist` |

Environment variable:

```
VITE_API_BASE_URL=https://api.sachfitsin.com/api/v1/
```

Two things that catch people here:

**The trailing slash matters.** Request paths are appended to this value.

**Vite bakes it in at build time, not run time.** Changing it in Render
later does nothing until you trigger a fresh deploy. If API calls go to the
wrong host, check this first and redeploy.

### Add the SPA rewrite — do not skip this

Render → the static site → **Redirects/Rewrites**:

| Source | Destination | Action |
|---|---|---|
| `/*` | `/index.html` | Rewrite |

Action must be **Rewrite**, not Redirect.

Without it, React Router never gets a chance to run. A customer who
refreshes on `/dashboard/plans`, or opens a link you sent them, gets a 404.
Clicking through from the homepage works fine — which is exactly why this
is easy to ship broken.

---

## 5. DNS for the frontend

Add `sachfitsin.com` and `www.sachfitsin.com` as custom domains on the
static site. Render shows the exact records.

The apex domain usually needs an A record or an ALIAS, depending on your
DNS provider. Follow what Render shows rather than guessing — it differs
between registrars.

---

## 6. Turn on HTTPS strictly — only after it works

Once HTTPS works on `sachfitsin.com`, `www.sachfitsin.com` and
`api.sachfitsin.com`:

```
SECURE_HSTS_SECONDS=31536000
```

Not before. HSTS tells browsers to refuse plain HTTP for your domain **and
they remember it for a year**. Switch it on while HTTPS is still patchy and
visitors are locked out, with no quick way to undo it.

---

## 7. Register the webhooks

These need a public HTTPS URL, which is why they come after deploying.

| Service | URL | Events |
|---|---|---|
| Razorpay | `https://api.sachfitsin.com/api/v1/payments/webhook/` | `payment.captured`, `payment.failed` |
| Calendly | `https://api.sachfitsin.com/api/v1/appointments/webhooks/calendly/` | invitee created, invitee cancelled |

The Razorpay secret you enter there must **exactly match**
`RAZORPAY_WEBHOOK_SECRET` on Render. A mismatch rejects every webhook with
a 400, silently — you would only find out when a customer who closed their
tab never got access.

Use a dedicated webhook secret. It is not your Razorpay API secret.

---

## 8. Email

Until a domain is verified, Resend only delivers to the address the account
was registered with. Real customers get nothing.

| Step | |
|---|---|
| 1 | Resend → Domains → Add `sachfitsin.com` |
| 2 | Add the DNS records it shows (SPF, DKIM, return-path) |
| 3 | Wait for **Verified** |
| 4 | Set `DEFAULT_FROM_EMAIL=Sachfitsin <hello@sachfitsin.com>` |

Step 4 is not optional. Leaving the sender as `onboarding@resend.dev` keeps
the restriction even after the domain verifies.

Check it from Render's Shell tab:

```bash
python manage.py send_test_email someone@example.com
```

---

## 9. Schedule the background commands

On Render, each one is a separate **Cron Job** service with Root Directory
set to `backend`.

| Command | Schedule | Needed? |
|---|---|---|
| `python manage.py expire_entitlements` | `0 2 * * *` | Recommended |
| `python manage.py sync_calendly` | `*/30 * * * *` | Optional safety net |

### `expire_entitlements`

This does **not** control access. `has_entitlement` checks the date on
every request, so a customer loses access on the right day whether or not
this runs. It only stops the admin showing long-lapsed plans as ACTIVE.

Run it with `--dry-run` first to see what it would touch.

### `sync_calendly`

The Calendly webhook from step 7 already keeps appointments current. This
command re-reads Calendly and catches anything a missed webhook dropped —
which on the free Render plan is a real possibility, since a sleeping
service can miss a delivery.

Skip it if you are on a paid plan and the webhook is working.

---

## 10. Create the plans

Dietician panel → **Plans & Pricing**, or Django admin → Products.

| Field | Watch out for |
|---|---|
| Code | Cannot be changed later. Entitlements are keyed to it |
| Price | A paid plan must be above zero — Razorpay refuses a ₹0 order |
| Billing | `MONTHLY` needs an access length in days |
| Free plans | Set billing to **Free**. Then every customer gets it, no payment needed |

A plan left at `ONE_TIME` with price 0 is unusable: it cannot be bought and
it is not granted. The admin form rejects that combination.

---

## 11. Test in Razorpay Test Mode before going live

| Test | Expected |
|---|---|
| Buy a one-time plan | Entitlement created, feature unlocks |
| Buy a monthly plan | Entitlement + Subscription, expiry set |
| Close the tab mid-payment | Webhook still grants access |
| A declined test card | Payment FAILED, no access |
| Payment history | Shows each attempt and its outcome |

On the free plan, allow for the spin-down: if the service was asleep, the
webhook test may take a minute to land.

Only after all five, start Razorpay **Live** onboarding. It needs business
verification and takes days, so leave time.

---

## After going live

| Do | Why |
|---|---|
| Turn on Neon backups / check the retention window | Your data is the one thing you cannot rebuild |
| Add error tracking (Sentry free tier) | A 500 currently only exists in logs you must go looking for |
| Watch Django admin → **Email logs** | Failed sends are recorded with the real reason |
| Watch Django admin → **Payments** | FAILED rows carry the reason Razorpay gave |
| Consider the Starter plan | Removes the 15-minute spin-down |

---

## If something breaks

| Symptom | Likely cause |
|---|---|
| Build fails, no `requirements.txt` found | Root Directory not set to `backend` |
| Every request 400s | `ALLOWED_HOSTS` missing your domain |
| Site works but Render says deploy unhealthy | `ALLOWED_HOSTS` missing the `.onrender.com` host |
| Frontend calls fail, console shows CORS | `CORS_ALLOWED_ORIGINS` does not match the frontend URL exactly, including `https://` |
| API calls go to the wrong host | `VITE_API_BASE_URL` changed but the frontend was not rebuilt |
| Refreshing a page gives 404 | Missing the SPA rewrite in step 4 |
| Admin has no styling | `collectstatic` missing from the Build Command |
| Webhooks all 400 | Secret on Render differs from the one in Razorpay |
| Emails only reach you | Domain not verified, or `DEFAULT_FROM_EMAIL` still `onboarding@resend.dev` |
| First request of the day is very slow | Free plan spin-down plus Neon wake. Expected |
| `terminating connection due to administrator command` | Neon suspended and `conn_health_checks` is off. It is on by default — check nobody removed it |
| Server will not start | A required variable from step 2 is missing. The log names which one |
