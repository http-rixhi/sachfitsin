# Security Audit & Hardening

Audit done before connecting Razorpay and deploying. Findings first, then
what changed, then what you still need to do.

---

## Findings

| # | Severity | Finding | Status |
|---|---|---|---|
| 1 | **Critical** | No `.gitignore`. The first commit would have published `.env` | Fixed |
| 2 | **High** | Refresh-token blacklisting was configured but did nothing | Fixed |
| 3 | **High** | `CORS_ALLOW_ALL_ORIGINS = True` let any website call the API | Fixed |
| 4 | **High** | No rate limit on login — passwords guessable at network speed | Fixed |
| 5 | Medium | No HTTPS or secure-cookie settings | Fixed |
| 6 | Medium | CORS and CSRF origins hardcoded to `localhost:5173` | Fixed |
| 7 | Medium | Sync secret compared in non-constant time; empty secret allowed entry | Fixed |
| 8 | Low | One endpoint returned a non-standard error body | Fixed |
| — | — | **Object-level authorization** | Already correct |

---

## 1. Secrets — the critical one

Nothing was committed yet, and there was **no `.gitignore` for the
backend**. Your first `git add .` would have published:

| File | What was in it |
|---|---|
| `backend/.env` | `SECRET_KEY`, database password, Calendly tokens |
| `backend/db.sqlite3` | Any local data |
| `backend/venv/` | 83 MB of packages |

Once a secret is pushed it is public forever, even after deleting it —
it stays in the git history and in anyone's clone.

**Fixed:** a root [`.gitignore`](../.gitignore) covering `.env`, `venv/`,
`db.sqlite3`, `node_modules/`, build output and editor files.

**Also added:** [`backend/.env.example`](../backend/.env.example) — every
variable with no values, safe to commit, so a new machine knows what to set.

### Before your first commit

```bash
cd "<project root>"
git status --short            # .env, venv/, db.sqlite3 must NOT appear
git check-ignore -v backend/.env    # must print a .gitignore line
```

If `.env` ever does get committed, treat every key in it as compromised:
rotate `SECRET_KEY`, the database password, and the Calendly tokens.
Rotating `SECRET_KEY` logs everyone out, which is the point.

---

## 2. Refresh tokens were never blacklisted

The settings said:

```python
"ROTATE_REFRESH_TOKENS": True,
"BLACKLIST_AFTER_ROTATION": True,
```

…but `rest_framework_simplejwt.token_blacklist` was **not** in
`INSTALLED_APPS`. Without that app the setting does nothing silently. A
stolen refresh token stayed valid for its full **7 days**, even after the
real user's token had been rotated.

**Fixed:** app installed. There is now a test that logs in, refreshes, then
replays the old token and requires a 401.

> **This needs a migration.** See "What you need to do" below.

---

## 3. CORS let any website call the API

Line 79 had `CORS_ALLOW_ALL_ORIGINS = True`, which silently overrode the
allowlist 100 lines further down. Any site on the internet could call your
API from a visitor's browser.

**Fixed:**

| Setting | Now |
|---|---|
| `CORS_ALLOW_ALL_ORIGINS` | `DEBUG` — on locally, never in production |
| `CORS_ALLOWED_ORIGINS` | From `.env`, defaults to `FRONTEND_URL` |
| `CSRF_TRUSTED_ORIGINS` | Same list |

Verified against a running production-mode server:

```
Origin: https://app.sachfitsin.com  →  access-control-allow-origin: https://app.sachfitsin.com
Origin: https://evil.example.com    →  (no header — the browser blocks it)
```

---

## 4. Rate limiting

There was none. Login could be hammered as fast as the network allowed.

| Endpoint | Limit | Env variable |
|---|---|---|
| Login + token refresh | 10/min | `THROTTLE_LOGIN` |
| Register | 20/hour | `THROTTLE_REGISTER` |
| Any anonymous request | 60/min | `THROTTLE_ANON` |
| Any logged-in request | 240/min | `THROTTLE_USER` |

A throttled response uses the standard error shape with
`code: "throttled"`.

> **Limitation worth knowing:** counts are kept in Django's local-memory
> cache, which is **per process**. With several Gunicorn workers each one
> counts separately, so the real limit is roughly the rate times the worker
> count. That is still a huge improvement over nothing. If you want it
> exact later, point `CACHES` at Redis — no code change needed.

---

## 5. Production settings

All of these switch on by themselves when `DEBUG=False`, so there is
nothing to remember at deploy time.

| Setting | Value | Why |
|---|---|---|
| `SECURE_SSL_REDIRECT` | on | Plain HTTP redirected to HTTPS |
| `SECURE_PROXY_SSL_HEADER` | set | Without it, SSL redirect loops forever behind a load balancer |
| `SESSION_COOKIE_SECURE` / `CSRF_COOKIE_SECURE` | on | Cookies never sent over plain HTTP |
| `SESSION_COOKIE_HTTPONLY` | on | JavaScript cannot read the session cookie |
| `X_FRAME_OPTIONS` | `DENY` | No clickjacking |
| `SECURE_CONTENT_TYPE_NOSNIFF` | on | Browsers respect the declared content type |
| `SECURE_REFERRER_POLICY` | `same-origin` | URLs not leaked to other sites |

Production also now **refuses to start** if `SECRET_KEY` is missing or
under 40 characters.

`ALLOWED_HOSTS` had a quiet bug: it contained `FRONTEND_URL`, which is a
full URL. `ALLOWED_HOSTS` matches bare hostnames, so that entry never
matched anything. The hostname is now parsed out of the URL.

### Django's own check

```bash
cd backend
DEBUG=False ./venv/bin/python manage.py check --deploy
```

| Stage | Warnings |
|---|---|
| Before | 4 |
| After | 1 |
| After, with HSTS on | 0 |

---

## 6. HSTS — the one thing left off on purpose

HSTS tells browsers to **refuse plain HTTP for your domain, and remember
it**. Turn it on before HTTPS works on every subdomain and visitors are
locked out, and their browsers will not forget for a long time.

So: deploy first, confirm HTTPS works everywhere, **then** add to `.env`:

```
SECURE_HSTS_SECONDS=31536000
```

That is one year. The subdomain and preload flags follow automatically.

---

## 7. Object-level authorization — already correct

This is the part that usually goes wrong, and yours was right. Every
customer-facing query is scoped to `request.user`.

Checked by trying it, not by reading it. Two customers and a dietician
exist; Customer A attempts to reach everything belonging to Customer B:

| Resource | Attempt | Result |
|---|---|---|
| Diet plans | List | Only their own |
| Appointments | List, confirm someone else's | Own only, 404 |
| Notifications | List, mark another's read | Own only, 404 |
| Calorie entries | List, edit another's | Own only, 404 |
| Water entries | List, delete another's | Own only, 404 |
| Calorie / water summary | Read | Own totals only |
| Customer profile | Read | Own profile only |
| Entitlements | List | Own only |
| Personalized videos | Read with the victim's entitlement | 403 `entitlement_required` |
| Every admin endpoint | 9 endpoints | 403 |
| Every private endpoint | 11 endpoints, logged out | 401 |

Also checked:

| Attempt | Result |
|---|---|
| Register with `"role": "DIETICIAN"` | Saved as CUSTOMER |
| PATCH own profile with `"role": "DIETICIAN"` | Ignored |
| Tampered JWT signature | 401 |
| Another user's valid token | Only sees their own data |
| Private video in the public list | Not present |

---

## 8. File storage (11F)

Not applicable yet — nothing is uploaded today. Images and videos are
external URLs typed in by the dietician.

When Cloudflare R2 is added, the rules that matter:

| Rule | Why |
|---|---|
| Bucket **not** public | Default-public is how customer files leak |
| Serve through short-lived presigned URLs | A leaked link expires |
| Never put the customer id in a guessable path | Stops walking through ids |
| R2 keys in `.env` only | Same as every other secret |

---

## 9. Razorpay, when you add it

| Rule | Why |
|---|---|
| Verify the webhook signature before trusting anything | Otherwise anyone can post a "payment succeeded" |
| Never trust an amount sent by the browser | Recompute it server-side |
| Keep the key secret out of the frontend bundle | Only the public key id belongs there |
| Make webhook handling idempotent | Razorpay retries; a repeat must not grant twice |
| Grant entitlements from the webhook, not the redirect | A customer can close the tab before the redirect |

The entitlement path already exists — the webhook should call
`events.entitlement_activated` so email and notifications come for free.

---

## 10. Tests

```bash
cd backend
./venv/bin/python manage.py test --settings=config.settings_test
```

**141 tests**, 33 of them security-specific in
[`api/tests/test_security.py`](../backend/api/tests/test_security.py).

One test caught a real mistake of mine: the register limit was first set to
5/hour, which broke other tests sharing the same IP — and would have
blocked a family or an office sharing one connection. Raised to 20/hour.

---

## What you need to do

**1. Run the migration** for the token blacklist tables:

```bash
cd backend
./venv/bin/python manage.py migrate
```

**2. Check nothing secret is staged** before your first commit:

```bash
git status --short      # .env and venv/ must not appear
```

**3. At deploy time**, set these in your host's environment:

```
DEBUG=False
SECRET_KEY=<a fresh 50-character key>
FRONTEND_URL=https://your-real-domain.com
ALLOWED_HOSTS=your-api-domain.com
CORS_ALLOWED_ORIGINS=https://your-real-domain.com
```

**4. After HTTPS is confirmed working**, add `SECURE_HSTS_SECONDS=31536000`.

**5. Use a different `SECRET_KEY` in production** from your local one. If
the local key has ever been shared or pasted anywhere, do not reuse it.
