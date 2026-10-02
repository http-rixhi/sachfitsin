# Error Handling & API Consistency

Every error from the Sachfitsin API comes back in one shape, and the front
end deals with it in one place.

---

## 1. The standard error shape

```json
{
  "error": {
    "code": "validation_error",
    "message": "Please check the highlighted fields and try again.",
    "status": 400,
    "fields": {
      "email": ["Enter a valid email address."]
    }
  }
}
```

| Key | What it is | Always there? |
|---|---|---|
| `code` | A fixed string your code checks. Wording never changes. | Yes |
| `message` | One plain sentence, safe to show a customer. | Yes |
| `status` | The HTTP status, repeated in the body. | Yes |
| `fields` | Field name → list of messages. | Only on validation errors |

**Check `code`, never `message`.** The message wording can change; the code
will not.

---

## 2. Every code

| Code | HTTP | When |
|---|---|---|
| `validation_error` | 400 | A field is missing, wrong, or already taken |
| `authentication_required` | 401 | No token was sent |
| `invalid_token` | 401 | The token is broken or rejected |
| `token_expired` | 401 | The token ran out |
| `invalid_credentials` | 401 | Wrong username or password at login |
| `permission_denied` | 403 | Logged in, but the wrong role |
| `entitlement_required` | 403 | Logged in, but the plan does not include it |
| `not_found` | 404 | No such record, or no such URL |
| `method_not_allowed` | 405 | Wrong HTTP method |
| `unsupported_media_type` | 415 | Wrong content type |
| `throttled` | 429 | Too many requests |
| `conflict` | 409 | The database refused it |
| `server_error` | 500 | A bug. Details go to the log, not the customer |
| `service_unavailable` | 503 | Temporarily overloaded |
| `network_error` | — | Front end only: the request never got an answer |

### Why `entitlement_required` is separate from `permission_denied`

They are both 403, but they mean very different things to a customer:

| Code | Meaning | What the UI shows |
|---|---|---|
| `permission_denied` | You are not allowed here at all | "Access denied" |
| `entitlement_required` | You could be, if you upgraded | "Not in your plan yet" |

---

## 3. Backend

| File | Job |
|---|---|
| `api/errors.py` | The shape, the codes, the default messages |
| `api/exceptions.py` | The DRF handler. Turns any exception into that shape |
| `api/handlers.py` | JSON 404 and 500 for URLs that never reach DRF |

Wired up with one line in settings:

```python
REST_FRAMEWORK = {
    "EXCEPTION_HANDLER": "api.exceptions.custom_exception_handler",
}
```

Nothing else needs changing. Every view already goes through it.

### Nested validation errors are flattened

DRF returns validation errors in several shapes. They are all flattened to
one level so the front end only handles one:

| DRF gives | You get |
|---|---|
| `{"email": ["Bad"]}` | `{"email": ["Bad"]}` |
| `{"profile": {"phone": ["Bad"]}}` | `{"profile.phone": ["Bad"]}` |
| `["Bad"]` | `{"non_field_errors": ["Bad"]}` |
| `"Bad"` | `{"non_field_errors": ["Bad"]}` |

---

## 4. Logging (10H)

| Status | Logged how | What the customer sees |
|---|---|---|
| 4xx | One INFO line: code, status, path, user id | The real reason |
| 5xx | `logger.exception` — full traceback | A fixed generic sentence |

A crash never describes itself to the customer. This is tested: a view made
to raise `RuntimeError("SECRET_KEY=abc123 leaked from /var/app/settings.py")`
returns only *"Something went wrong on our side. Please try again."*, and the
response body is checked for each of those words.

Logger name is `api.errors`. Level via `API_LOG_LEVEL` in `.env`.

### Login does not reveal which usernames exist

A wrong password and an unknown username return byte-for-byte the same
response. Tested.

---

## 5. Front end

| File | Job |
|---|---|
| `lib/api-error.ts` | Normalises anything thrown into one `ApiError` |
| `services/api.ts` | Axios setup, token refresh, session expiry |
| `lib/query-client.ts` | One retry policy for every query |
| `components/ui/error-state.tsx` | The error blocks every page uses |
| `components/ui/form-error.tsx` | The red box above a form |
| `components/ErrorBoundary.tsx` | Catches render crashes |

### Helpers

```ts
errorMessage(error)          // the sentence to show
fieldErrors(error)           // { email: "Enter a valid email address." }
isAuthError(error)           // session problem
isPermissionError(error)     // wrong role
isEntitlementError(error)    // not in their plan
isRetryable(error)           // worth offering a Try again button
```

A network failure has no response body at all, so it is normalised too —
`code: "network_error"`. Pages do not have to check for that separately.

### Retry policy

| Error | Retried? |
|---|---|
| Network failure | Yes, twice, backing off |
| 5xx | Yes, twice, backing off |
| 4xx | No — the answer will not change |
| Auth errors | No — the Axios layer is already handling it |
| Any mutation | No — the user presses the button again |

### Token refresh

When the access token expires, every in-flight request fails at once. The
old code refreshed for the first one and **rejected the rest**, so a
dashboard loading six things showed five errors. Now they all wait on the
same refresh and are retried with the new token.

If the refresh itself fails, the session ends: tokens are cleared and a
`sachfitsin:session-expired` event fires, which `AuthContext` listens for.
The route guards then send the user to the login page with a notice.

---

## 6. What the customer actually sees

| Situation | Screen |
|---|---|
| Server unreachable | "You appear to be offline" + **Try again** |
| 500 | "Something went wrong" + **Try again** |
| Wrong role | "Access denied" + back to home |
| Not in their plan | "Not in your plan yet" + ask your dietician |
| Bad form field | Red message under that exact input |
| Session expired | Sent to login with "Please login first…" |
| Render crash | Full-page "Something went wrong" + **Reload** |

---

## 7. Tests

```bash
cd backend
./venv/bin/python manage.py test --settings=config.settings_test
```

70 tests. The error ones trigger real failures through real endpoints
rather than calling the handler directly, so a view that somehow bypassed
the handler would be caught.

Covered: every validation case, no token, bad token, expired token, wrong
password, unknown username, wrong role, missing entitlement, missing
record, unknown URL, wrong method, malformed JSON, and an unhandled crash.

### Two bugs these tests did not catch

Both were found by running a real server and hitting it with `curl`, which
is why that step matters:

| Bug | Why the unit tests missed it |
|---|---|
| A wrong password said *"Your session is no longer valid"* | Both arrive as `AuthenticationFailed`; the test only asserted the status code |
| Unknown URLs returned Django's HTML page | The test client runs with `DEBUG=False`, where it worked; `DEBUG=True` bypasses `handler404` |

The second one is normal Django behaviour, not a defect: with `DEBUG=True`
you will see Django's HTML debug page for an unknown URL. In production
(`DEBUG=False`) you get the JSON. Verified both ways.
