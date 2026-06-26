# scripts/

Helper scripts for the client portal frontend.

## smoke-test-quotes — manual verification of the BFF fix

This directory is reserved for `smoke-test-quotes.mjs`, a zero-dependency
Node script that exercises the portal BFF (`/functions/v1/client-portal-modules/quotes`)
with a real client JWT and confirms the response includes the CRM quote
`2026-P-00001`.

**The script is NOT checked in yet**, because writing it requires the
client's password (Supabase password grant) to obtain a JWT, and that
credential must never be committed.

### How to get a JWT manually

The portal frontend runs against the Supabase project
`lsntpezzhinnohggezxy.supabase.co` (anon key is public and lives in
`src/environments/environment.ts`). The same project's `/auth/v1/token`
endpoint mints an `access_token` JWT when given email + password.

#### Option A — password grant (requires the client's password)

```bash
# Run from the repo root or any folder; nothing project-specific needed.

curl -s -X POST \
  'https://lsntpezzhinnohggezxy.supabase.co/auth/v1/token?grant_type=password' \
  -H 'apikey: sb_publishable_CF4Bkzjh4kDBNfY3avOpaw_7YTeVQBc' \
  -H 'Content-Type: application/json' \
  -d '{"email":"puchu_114@hotmail.com","password":"<ASK THE USER>"}'
```

The JSON response includes `access_token` (and `refresh_token`). Copy
`access_token` into the `PORTAL_JWT` env var below.

If the client does not want to share the password, use Option B.

#### Option B — sign in through the running portal

1. Open `https://portal.simplificacrm.es` in a browser.
2. Sign in as `puchu_114@hotmail.com`.
3. Open DevTools → Application → Local Storage → look for the
   `sb-<projectref>-auth-token` key. It contains `access_token` and
   `refresh_token` (the JWT is a 3-part dot-separated string starting with
   `eyJ...`).

#### Verify the BFF with the JWT

Once you have a JWT (either source), confirm the BFF returns the
expected quote with a one-liner:

```bash
JWT="eyJ...paste..."
curl -s 'https://lsntpezzhinnohggezxy.supabase.co/functions/v1/client-portal-modules/quotes' \
  -H "Authorization: Bearer $JWT" \
  -H 'apikey: sb_publishable_CF4Bkzjh4kDBNfY3avOpaw_7YTeVQBc' \
  | python -m json.tool
```

#### Expected (after the BFF fix + the user changes the quote status to `sent`)

```json
{
  "data": [
    {
      "id": "ba7f0c63-4ae8-4c09-b864-4677c5a783b7",
      "quote_number": "2026-P-00001",
      "full_quote_number": "2026-P-00001",
      "title": "Licencia Sincronia Booking",
      "status": "sent",
      "quote_date": "...",
      "valid_until": "...",
      "total_amount": 100.00,
      "currency": "EUR"
    }
  ],
  "_debug": {
    "client_id": "57c3f125-bc98-4f0f-8352-1952fca8db03",
    "company_id": "6f25fbb1-60ba-4f8b-adc5-70f35cdf77ca",
    "count": 1,
    "source": "crm"
  }
}
```

If `_debug.source` is anything other than `"crm"`, the fix is not
deployed. If `_debug.count` is `0` and the user's quote was already
flipped to `sent`, double-check that `client_portal_users.client_id` and
`client_portal_users.company_id` match the CRM row that owns the quote.

### Re-enabling the smoke test script

If/when the user provides the client password, drop a
`smoke-test-quotes.mjs` here that:

- reads `PORTAL_JWT` from env (or fails with a clear message),
- GETs the BFF `/quotes` endpoint with `Authorization: Bearer ${PORTAL_JWT}`,
- asserts the response JSON contains a quote with
  `full_quote_number === "2026-P-00001"`,
- prints `PASS` / `FAIL` with the relevant excerpt.

No new npm dependencies — Node's built-in `fetch` (≥ 18) is enough.

### Related context

- BFF commit that switched quotes to read from the CRM:
  `fix(portal-bff): read quotes from CRM DB and expose _debug context`.
- BFF commit that does the same for invoices:
  `fix(portal-bff): also fix handleInvoices + smoke test script`.
