# MoneyMore — Handoff (2026-09-22)

## Project

Thai-language short-term informal-lending (ปล่อยกู้นอกระบบ) tracker for a single lender.
- **Frontend**: Next.js (App Router) + Tailwind + shadcn/ui
- **Backend**: Google Sheets, accessed via a Google Apps Script Web App as a JSON API
- **Auth**: NextAuth (Auth.js v5) + Google OAuth, restricted to one email
- **Hosting**: Vercel (Hobby/free plan)

Full requirements and design decisions were captured interactively (via `/grill-me`) and written to the plan file at `C:\Users\peera\.claude\plans\1-cuddly-cerf.md` and copied into the repo at [docs/plan.md](../docs/plan.md). **Read that file first** — it has the full interest/repayment/early-close business logic spec, don't re-derive it here.

## Current state: fully working end-to-end, redesigned, deployed

- Repo: https://github.com/peerapatbps/money-more (branch `main`), latest commit `14c53ee` "Redesign UI, add history page, fix rate table axis"
- Production: https://money-more-teal.vercel.app — deployed, login tested, Sheets connection tested, redesigned UI verified live.
- Google Cloud project: "MoneyMore" (OAuth consent screen in **Testing** mode, External user type — only the one test user email can log in until the app is published/verified)
- Apps Script project: bound to the Google Sheet named "Money & More" in the lender's Drive (see gotcha below about the confusing file naming). Currently deployed at **version 2** (added `listAllPayments` action).
- 4 Sheet tabs exist with correct headers: Debtors, Loans, Installments, Payments — **all confirmed empty** as of end of this session (smoke-test data was created and then deliberately deleted, see below).

## Key files

- [lib/interest.ts](../lib/interest.ts) — all interest/repayment/early-close calculation logic (client-side + mirrored in Apps Script). Rate table's time axis now starts at 1 (was 3) per this session's change at `buildRateTable`'s default `periodsRange`.
- [apps-script/Code.gs](../apps-script/Code.gs), [Interest.gs](../apps-script/Interest.gs), [Sheets.gs](../apps-script/Sheets.gs), [Setup.gs](../apps-script/Setup.gs) — backend; **must be kept in sync manually** with `lib/interest.ts` since they're two separate runtimes with duplicated logic. `Code.gs` now also has a `listAllPayments` action (returns all Payments rows, unfiltered) added this session for the history page.
- [lib/sheetsApi.ts](../lib/sheetsApi.ts) — typed client wrapper Next.js uses to call the Apps Script Web App. Has `listAllPayments()` added this session.
- [app/(dashboard)/history/page.tsx](../app/(dashboard)/history/page.tsx) — **new this session**. Server component showing (1) all payments across all debtors sorted newest-first, (2) all closed loans with collected total and close date. Linked from the dashboard nav.
- [app/globals.css](../app/globals.css), [app/layout.tsx](../app/layout.tsx) — new warm-neutral "editorial" design system (near-black `#090806` / cream `#FAF8F4` / terracotta accent `#9A653F`/`#E29750`), referenced from a Dribbble shot ("Lune Atelier"). Fraunces serif added for headings (`font-heading`), Geist kept for body text. Full dark-mode token set included though the app doesn't currently expose a theme toggle.
- [apps-script/README.md](../apps-script/README.md) — setup steps for a fresh Apps Script deployment.
- `.claude/launch.json` — **new this session**, lets the `run`/Browser-pane tooling start `npm run dev` on port 3000 without prompting each time.
- `.env.local` (not in git) — has all required vars filled in already on this machine; see `.env.local.example` for the schema.

## Credentials / secrets (NOT reproduced here — redacted)

All of the following exist and are already configured in both `.env.local` (local dev) and the Vercel project's Environment Variables (production) — do not need to be recreated, just be aware they exist:
- `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` — OAuth client "MoneyMore Web" in the "MoneyMore" GCP project
- `AUTH_SECRET` — NextAuth session secret
- `ALLOWED_EMAIL` — the one email allowed to log in
- `SHEETS_API_URL` — the Apps Script Web App `/exec` URL (same URL across the version-1→version-2 redeploy this session; deployment URL stays stable across "new version" deploys, only changes if you create a brand-new deployment)
- `SHEETS_API_SECRET` — shared-secret token checked by `Code.gs` `doPost`

If any of these need rotating, do it in both places (Google Cloud Console / Apps Script Script Properties, and Vercel project settings) and redeploy.

## Gotchas hit across sessions (read before touching Apps Script, Sheets, or OAuth again)

1. **Apps Script hides any function ending in `_`** from the Run-function dropdown in the editor UI. `setupSheets_` could never be selected directly — fixed by adding a public `runSetup()` wrapper in `Setup.gs` that just calls `setupSheets_()`. Keep this pattern for any new "run manually from the editor" entry points.
2. **Apps Script must be opened via Extensions → Apps Script from inside the target Sheet**, not from script.google.com directly — otherwise you get a standalone script not bound to any spreadsheet, and `SpreadsheetApp.getActiveSpreadsheet()` fails/no-ops. When going through script.google.com's project list instead, there are **two similarly-named projects** — "Money & More" (correct, bound) and "Money&More" (decoy/unrelated) — verify you're in the right one before editing.
3. **Google Drive had two confusingly-similar files**: "Money & More" (the real one, bound Apps Script project lives here) and "Money&More" (a decoy/unrelated file — turned out to be a Drive shortcut icon, not a real duplicate). If you see two similar filenames in Drive again, verify the file ID matches before assuming which is correct.
4. **Vercel's env var Key input does not auto-parse a multi-line pasted `.env` block when text is typed via automation (non-native paste event)** — it just concatenates everything into one Key field. Had to add each of the 6 vars one at a time via "Add More". A real clipboard paste (Ctrl+V) would likely auto-split correctly if doing this by hand.
5. **`redirect_uri_mismatch` on first production login attempt** turned out to be a transient OAuth-settings propagation delay (Google says "5 minutes to a few hours") after adding the Vercel domain to the OAuth client's authorized origins/redirect URIs — retried a minute later and it worked.
6. **A transient "Sheets API error: 404 Not Found"** can appear on page loads, seemingly at random (seen again this session after heavy Apps Script activity, and once right after a dev-server restart). Root cause not fully confirmed — likely propagation/cold-start/quota related on Google's side, not a code bug. Apps Script Web Apps respond to POST with a 302 redirect to a `script.googleusercontent.com` URL that itself only accepts GET — this is normal and both `curl -L` (naively) and Node's native `fetch` handle it correctly by converting POST→GET on redirect per the WHATWG fetch spec, so `lib/sheetsApi.ts`'s plain `fetch()` call does not need a manual redirect workaround. **If it recurs, just reload/retry** — it has resolved itself every time so far.
7. **A long-running `npm run dev` process holds `.env.local` in memory at the values it had when it started.** If you edit `.env.local` (e.g. after redeploying Apps Script to a new URL) while an old dev server is still running, requests will silently use the stale values and you'll get confusing errors (like the 404 above) even though a fresh `curl` to the same endpoint works fine. **Restart the dev server after any `.env.local` change.**
8. **Apps Script Web App round-trips are slow — 5 to 35 seconds per request is normal**, not a bug. `createLoan` writes one row to `Loans` plus one row per installment, sequentially; `recordPayment`/`listAllPayments`/etc. each involve a full Sheets read+write round trip through Google's infrastructure. Don't assume a stuck "Saving..." button means something is broken — wait at least 30–40s before investigating further, and check the Next dev server's terminal/log output (request duration is logged) before assuming a hang.
9. **Editing Apps Script's `Code.gs` through browser automation (computer-use style clicking/typing) is unreliable for structural edits.** In this session, standalone `key` actions (Enter, Backspace, Delete, Ctrl+S) silently did nothing on the Apps Script Monaco-based editor — only the `type` action (which simulates real character input) actually worked, including for inserting newlines via `\n` in the typed string. Practical technique that worked: **select the exact text to replace via mouse (click + shift-click or triple-click), then `type` the full replacement text over the selection** — never rely on positioning a bare cursor and pressing a key. Auto-indent will produce ugly (but functionally correct) indentation when doing this; that's cosmetic only and safe to leave. Save via clicking the actual save icon/button in the toolbar, not `Ctrl+S` as a key action.
10. **Manually deleting several rows across Google Sheets tabs in rapid succession via browser automation is risky.** In this session, deleting a confirmed test row in each of the 4 tabs (Debtors, Loans, Installments, Payments) one after another — verifying the row's `id` in the formula bar before each delete — nonetheless resulted in the **real, non-test rows also getting silently deleted** by the time of a later API check (root cause not confirmed — likely a client/server sync race from switching tabs before the previous tab's delete had fully saved). **Recovery**: Google Sheets' own Version History (clock icon, top toolbar) saved the day — it showed a clean checkpoint version (right after the intended deletes, right before the accidental extra ones) that could be restored via "คืนค่าเวอร์ชันนี้" (Restore this version). **Lesson for next time doing bulk row deletes via automation: delete one row, then explicitly wait for the "บันทึกไปยังไดรฟ์แล้ว" (saved) indicator before switching sheet tabs or deleting the next row**, rather than firing off deletes back-to-back across tabs.
11. **The user pasted a plaintext Google account password into chat mid-session** (prior session). I refused to use it and told them to change it immediately. No idea if they did — worth a gentle check-in if account security comes up again, but don't re-surface the actual string.

## What happened this session (2026-09-22, second half)

- **Full UI redesign**, referencing a Dribbble shot ("Lune Atelier – Built Responsive Website" by PLATFORM) for a warm-neutral, editorial, "less is more" aesthetic. Changed: [app/globals.css](../app/globals.css) (new color tokens, light+dark), [app/layout.tsx](../app/layout.tsx) (added Fraunces serif font), header/nav in [app/(dashboard)/layout.tsx](../app/(dashboard)/layout.tsx), the login page, the dashboard summary page, the new-loan form, and the debtor-detail page. No workflow/logic changes — purely visual (classNames/tokens), verified with `tsc --noEmit` and a live browser check of the login page (couldn't get past Google OAuth in the sandboxed browser to check the rest at the time, but later smoke-tested successfully — see below).
- Fixed the rate table's time axis (on `/loans/new`) to start at 1 instead of 3 (one-line change in `lib/interest.ts`'s `buildRateTable` default `periodsRange`).
- **Added a `/history` page** (new payments log + closed-loans list, both across all debtors) — required adding a new Apps Script backend action `listAllPayments`, which needed its own manual edit-and-redeploy cycle in the Apps Script editor (see gotcha #9). Deployed as Apps Script version 2, same Web App URL.
- **Smoke-tested the full flow live**: created a real test loan ("ทดสอบ ระบบ", ฿10,000 @ 5%/week × 4) through the `/loans/new` UI, recorded a ฿5,000 payment through the debtor-detail UI, confirmed the payment-allocation logic (interest-first, matching the documented business rules) reflected correctly on-screen, and confirmed the payment showed up on the new `/history` page.
- **Cleaned up all test/sample data from the Google Sheet** afterward, including — per explicit user correction mid-cleanup — the pre-existing "หมาน้อย" debtor/loan that had been sitting in the sheet from an earlier session (user clarified this was also just test data, not real data to preserve). Hit and recovered from the Sheets Version History issue described in gotcha #10. **All 4 sheet tabs are now confirmed empty** via a direct API check (`listDebtors`/`listLoans`/`listAllPayments` all return `[]`).
- **Committed and pushed to GitHub** (`14c53ee`, message: "Redesign UI, add history page, fix rate table axis"), which triggered Vercel's auto-deploy. Verified in the Vercel dashboard that the deployment built successfully (Ready, ~23s build) and was promoted to Production, and did a final live check of https://money-more-teal.vercel.app confirming the new UI renders correctly with the (now-empty) real data.

## What's NOT done yet

- **No real data entered** — all 4 Sheet tabs are empty (test data was created and then intentionally removed this session). Next natural step is to create the first real debtor + loan through the UI (`/loans/new`) to start actual use.
- **OAuth consent screen is still in Testing mode** — fine for single-user use indefinitely (Google doesn't force publishing for internal/personal use at this scale), but if the lender ever wants to add more test users beyond the 100 cap or remove the "unverified app" warning screen, it needs to go through Google's verification process.
- No automated tests exist anywhere in the repo.
- No CI/CD beyond Vercel's default GitHub-push-triggers-deploy.
- The redesign added full dark-mode CSS tokens but there's no UI control to toggle it — currently follows `prefers-color-scheme` only implicitly via the `.dark` class selector, which nothing currently applies. Low priority, but worth knowing if dark mode is ever requested.

## Suggested skills for the next session

- **run** — if the next session needs to verify a UI or logic change, use this to spin up `npm run dev` (launch config already exists at `.claude/launch.json`) and click through the flow rather than trusting untested code. Remember gotcha #8 (Apps Script round-trips take 5–35s) — don't assume a hang.
- **code-review** — if the next session's work involves modifying `lib/interest.ts`, `apps-script/*.gs`, or any payment/early-close logic, run this before considering it done — money-math bugs are the highest-risk category of bug in this codebase.
- **security-review** — worth running once before any real financial data goes into the Sheet, specifically checking the Apps Script `doPost` token check and the NextAuth `ALLOWED_EMAIL` gate for bypasses.
- **frontend-design** or **artifact-design** — if further visual polish is requested (e.g. dark mode toggle, mobile responsiveness pass), these carry the design-system guidance that informed this session's redesign; keep the existing warm-neutral token set in `app/globals.css` as the baseline rather than starting over.
