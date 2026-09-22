# MoneyMore — Handoff (2026-09-22)

## Project

Thai-language short-term informal-lending (ปล่อยกู้นอกระบบ) tracker for a single lender.
- **Frontend**: Next.js (App Router) + Tailwind + shadcn/ui
- **Backend**: Google Sheets, accessed via a Google Apps Script Web App as a JSON API
- **Auth**: NextAuth (Auth.js v5) + Google OAuth, restricted to one email
- **Hosting**: Vercel (Hobby/free plan)

Full requirements and design decisions were captured interactively (via `/grill-me`) and written to the plan file at `C:\Users\peera\.claude\plans\1-cuddly-cerf.md` and copied into the repo at [docs/plan.md](../docs/plan.md). **Read that file first** — it has the full interest/repayment/early-close business logic spec, don't re-derive it here.

## Current state: fully working end-to-end

- Repo: https://github.com/peerapatbps/money-more (branch `main`)
- Production: https://money-more-teal.vercel.app — deployed, login tested, Sheets connection tested, all working as of end of last session.
- Google Cloud project: "MoneyMore" (OAuth consent screen in **Testing** mode, External user type — only the one test user email can log in until the app is published/verified)
- Apps Script project: bound to the Google Sheet named "Money & More" in the lender's Drive (see gotcha below about the confusing file naming)
- 4 Sheet tabs exist with correct headers: Debtors, Loans, Installments, Payments (all currently empty — no real data has been entered yet)

## Key files

- [lib/interest.ts](../lib/interest.ts) — all interest/repayment/early-close calculation logic (client-side + mirrored in Apps Script)
- [apps-script/Code.gs](../apps-script/Code.gs), [Interest.gs](../apps-script/Interest.gs), [Sheets.gs](../apps-script/Sheets.gs), [Setup.gs](../apps-script/Setup.gs) — backend; **must be kept in sync manually** with `lib/interest.ts` since they're two separate runtimes with duplicated logic
- [lib/sheetsApi.ts](../lib/sheetsApi.ts) — typed client wrapper Next.js uses to call the Apps Script Web App
- [apps-script/README.md](../apps-script/README.md) — setup steps for a fresh Apps Script deployment
- `.env.local` (not in git) — has all required vars filled in already on this machine; see `.env.local.example` for the schema

## Credentials / secrets (NOT reproduced here — redacted)

All of the following exist and are already configured in both `.env.local` (local dev) and the Vercel project's Environment Variables (production) — do not need to be recreated, just be aware they exist:
- `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` — OAuth client "MoneyMore Web" in the "MoneyMore" GCP project
- `AUTH_SECRET` — NextAuth session secret
- `ALLOWED_EMAIL` — the one email allowed to log in
- `SHEETS_API_URL` — the Apps Script Web App `/exec` URL
- `SHEETS_API_SECRET` — shared-secret token checked by `Code.gs` `doPost`

If any of these need rotating, do it in both places (Google Cloud Console / Apps Script Script Properties, and Vercel project settings) and redeploy.

## Gotchas hit this session (read before touching Apps Script or OAuth again)

1. **Apps Script hides any function ending in `_`** from the Run-function dropdown in the editor UI. `setupSheets_` could never be selected directly — fixed by adding a public `runSetup()` wrapper in `Setup.gs` that just calls `setupSheets_()`. Keep this pattern for any new "run manually from the editor" entry points.
2. **Apps Script must be opened via Extensions → Apps Script from inside the target Sheet**, not from script.google.com directly — otherwise you get a standalone script not bound to any spreadsheet, and `SpreadsheetApp.getActiveSpreadsheet()` fails/no-ops.
3. **Google Drive had two confusingly-similar files**: "Money & More" (the real one, bound Apps Script project lives here) and "Money&More" (a decoy/unrelated file — turned out to be a Drive shortcut icon, not a real duplicate). If you see two similar filenames in Drive again, verify the file ID matches before assuming which is correct.
4. **Vercel's env var Key input does not auto-parse a multi-line pasted `.env` block when text is typed via automation (non-native paste event)** — it just concatenates everything into one Key field. Had to add each of the 6 vars one at a time via "Add More". A real clipboard paste (Ctrl+V) would likely auto-split correctly if doing this by hand.
5. **`redirect_uri_mismatch` on first production login attempt** turned out to be a transient OAuth-settings propagation delay (Google says "5 minutes to a few hours") after adding the Vercel domain to the OAuth client's authorized origins/redirect URIs — retried a minute later and it worked.
6. **A transient "Sheets API error: 404 Not Found"** appeared on the very first production page load after deploy, then resolved itself on the next load with no code change. Root cause not fully confirmed — likely also propagation/cold-start related, not a code bug. Apps Script Web Apps respond to POST with a 302 redirect to a `script.googleusercontent.com` URL that itself only accepts GET — this is normal and both `curl -L` (naively) and Node's native `fetch` handle it correctly by converting POST→GET on redirect per the WHATWG fetch spec, so `lib/sheetsApi.ts`'s plain `fetch()` call does not need a manual redirect workaround. If the 404 recurs, check this first but it's probably not the cause.
7. **The user pasted a plaintext Google account password into chat mid-session.** I refused to use it and told them to change it immediately. No idea if they did — worth a gentle check-in if account security comes up again, but don't re-surface the actual string.

## What's NOT done yet

- **No real data entered** — all 4 Sheet tabs are empty. Next natural step is to create the first debtor + loan through the UI (`/loans/new`) to smoke-test the full flow: create loan → record payment → early-close.
- **OAuth consent screen is still in Testing mode** — fine for single-user use indefinitely (Google doesn't force publishing for internal/personal use at this scale), but if the lender ever wants to add more test users beyond the 100 cap or remove the "unverified app" warning screen, it needs to go through Google's verification process.
- No automated tests exist anywhere in the repo.
- No CI/CD beyond Vercel's default GitHub-push-triggers-deploy.

## Suggested skills for the next session

- **code-review** — if the next session's work involves modifying `lib/interest.ts`, `apps-script/*.gs`, or any payment/early-close logic, run this before considering it done — money-math bugs are the highest-risk category of bug in this codebase.
- **security-review** — worth running once before any real financial data goes into the Sheet, specifically checking the Apps Script `doPost` token check and the NextAuth `ALLOWED_EMAIL` gate for bypasses.
- **run** — useful for the next session to spin up `npm run dev` and click through the loan-creation flow rather than trusting untested code.
