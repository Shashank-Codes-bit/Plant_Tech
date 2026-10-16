# Hara Hisaab: where we are (session notes, 17 Oct 2026)

Hand-over notes so the next session can pick up without the old chat. No secrets here: keys and
passwords live only in the VM's `deploy/.env` and in EAS, and the owner enters them.

## The project in one paragraph
**Hara Hisaab (हरा हिसाब)**, formerly NurseryPOS, is a multi-tenant point-of-sale app for plant nurseries.
- **App:** Expo SDK 57 (`frontend/`).
- **Backend:** FastAPI and MongoDB (`backend/`) on the shared Oracle VM behind Caddy.
- **Repo:** `Shashank-Codes-bit/Plant_Tech` (git remote `plant_tech`; `origin` is the old udyanojha/Nzone).
- **Branches:** `staging` deploys to https://nurserypos-staging.140-238-251-141.sslip.io (port 8130, `~/Plant_Tech-staging`). Prod uses port 8120.
- **Deploy:** pushing `staging` runs the GitHub Actions deploy. It is live when the new endpoints appear in `/openapi.json`.

## Standing rules from the owner
- **No app builds or over-the-air updates** (QA, prod or dev) until the owner has tested in the browser and said go.
- **Shared VM:** never touch other sites, never `docker compose down -v`, never start another Caddy, keep ports localhost-only, and check `ss -ltn` first.
- **No permanent deletes of data by Claude.** The owner runs `~/nurserypos-wipe.sh` themselves.
- **Test logins only on localhost** against the local API, never typed into the browser against staging.
- **Demo customers' phone numbers are dummies.** Don't WhatsApp them.
- **Design:** must look classy, not cheap. No "…" cut-off text, no emoji, quiet branding.
- **Plan first** for big changes, then build.

## How to test
- **Local (safe for logins):**
  - **Servers:** launch configs `nurserypos-api-local` (port 8001, in-memory Mongo, demo owner 9000000009, password in the launch config env) and `nurserypos-web-local` (port 8082).
  - **Seed data:** the local API seeds a full demo shop.
- **Owner's browser test app:** `nurserypos-web-staging` at http://localhost:8083, pointed at the staging API.
  - **One web server at a time:** stop 8082 before starting 8083 and vice versa. Two web servers with `--clear` collide (EBUSY).
  - **Stale route types:** after adding route files, restart the dev server if `tsc` complains about typed routes. The watcher on this OneDrive folder mis-registers new files until a restart.
- **Phone:** the QA APK, "Hara Hisaab QA" (`com.planteck.nurserypos.qa`, EAS profile `staging`, channel staging).
- **Backend tests:** pytest with mongomock (41 passing).
- **App checks:** `npx tsc --noEmit` and `npx eslint app src` (warnings only, no errors).

## Done in this session (all in this commit)
1. **One saved order per customer, never listed.**
   - **Backend:** `backend/routers/carts.py` replaces `drafts.py`, with `GET/PUT/DELETE /api/orders/cart?customer_id=`.
     - Collection `carts` is unique per (shop, customer). A cart untouched for 7 days is dropped.
     - Making the bill clears that customer's cart.
   - **App:** `src/cart-context.tsx` has `openFor`, `moveTo`, `startNew`, `discard`, `beforeBill`, `billed` and `setPrice`. Changes save to the server after 600 ms.
   - **Picking a customer** in New order loads their saved items with a toast ("Kavita Joshi's saved order: 2 items") and opens the order.
   - **"Change" customer** moves the items to the new customer.
   - **Home:** the old "Continue order / Discard" card is gone.
2. **Discard order:** a small red "Discard" button in the Add items and Order headers. It asks first, then goes Home, and the order is not kept.
3. **Price editable while ordering, read-only once billed.**
   - **Order screen:** each line has a ₹ price box. A changed line shows "Shop price ~~₹199~~".
   - **Server:** stores `list_price` on invoice lines sold at a different price.
   - **Bills:** the in-app bill shows the shop price. The customer's bill and PDF show only the final price.
4. **Bills no longer send `cost_price`** to the app (employees could read margins through the API).
5. **Bottom overlap:** `Screen` now pads above the phone's buttons by default. `BottomBar` runs its white behind them. The 5 tab screens use `edgeBottom={false}`.
6. **Reports:**
   - **Every item sold:** `items: [{name, quantity, amount}]`, shown as "Items sold". `top` is kept for older app versions.
   - **Chart bars** can be tapped to show their total.
   - **Shared period picker:** `src/components/period.tsx`.
7. **Employees:**
   - **Rename:** "Staff/Worker" is now "Employees/Employee" in all screen text and in the backend message. Code names and the `/more/staff` routes stay.
   - **Performance tab:** new `GET /api/reports/employees?range=day|week|month&date=` (owner only). It shows orders, sales, items, average bill, customers, first and last bill time, share of sales, discount, and lines sold at a changed price.
   - **Tapping a person** opens `app/more/employee-orders.tsx`, which is the Orders list pre-filtered to that person and period, with Back. The Orders list now lives in `src/components/orders-view.tsx`.
   - **Manage tab:** the old list plus "Add employee".
8. **Wording:** a `plural()` helper fixes "1 items" and "1 orders".
9. **Login bug, half fixed:** a 401 reply to a request sent *before* the saved login was read no longer logs the user out (`src/api.ts`).
10. **Docs:** `docs/QA-CHECKLIST.md` is updated (G.0b–G.0j, H.9, I.7/I.7a/I.11, K section, P.5a/P.5b).

**Checked in the local browser at 360 px:** the two-customer flow, saved order surviving a reload, the price change and its display on the bill, Discard from both screens, and direct-link redirect to the customer step.
**Not yet checked in the browser:** Reports (items list, bar taps), Employees Performance/Manage, and the bottom gap on a real phone.

## Open items for next session
1. **Browser test of the new staging deploy** at http://localhost:8083: Reports, Employees, and the full order flow. Then the owner says go or gives feedback.
2. **Login-wait fix (not applied; the owner stopped it mid-edit).** After a page reload, a screen deep-linked straight to (for example `/more/reports`) can query before the saved login is read and show "Please log in" until Try again. The proposed fix: render the root `<Stack/>` only once `useAuth().ready` is true (in `app/_layout.tsx`). Ask the owner before doing it.
3. **Welcome page and brand polish.** The owner must pick **A · Brand green**, **B · Picture** or **C · Clean**, and approve the **"Brand in the app"** board, on the design canvas (https://claude.ai/artifact/JNyyF5Zo4hHZAezhMRRwED, version 12). Then build:
   - `app/welcome.tsx`
   - Log in / Sign up: a centred small mark plus हरा हिसाब, with no corner mark
   - Home default logo: a white tile with a hairline border
   - More footer: one grey line "हरा हिसाब · v1.0.0"
   - A lighter bill footer
   - "HARA HISAAB" in small tracked caps
4. **Plant identification upgrade:** research is done, no code yet.
   - Use Opus with higher effort and full-size photos.
   - Return the top 3 answers.
   - Match against the shop's own photos.
   - Optionally add a Pl@ntNet helper.
5. **QA build or OTA update:** only after the owner's browser go.
6. **Production release:** after staging passes (QA-CHECKLIST section R).

## Demo shop
- **Account:** owner 9654346434 on staging (also the admin), "Green House" shop. It has 25 plants, 15 products, 45 customers and ~400 orders.
- **Daily refresh:** a cron job runs at 00:00 UTC (5:30 am IST) with `deploy/demo-refresh.sh staging 9654346434`. It moves all dates forward so the newest day is always today, and refuses to run on non-demo shops.
