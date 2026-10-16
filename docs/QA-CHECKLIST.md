# NurseryPOS test cases

Run these before every release. They try to break the app on purpose: wrong inputs, two phones at once, no
network, big fonts, workers going where they shouldn't, and direct API calls that skip the app.

**Where to test**
- **Browser** (fastest): http://localhost:8083 while Claude's preview runs; it talks to the staging server.
  Camera, Android back button, Download folder and phone font size can only be checked on a phone.
- **Phone**: the "NurseryPOS QA" app (staging server). Prod app only for section R.
- **API** (section P): `curl` or Postman against `https://nurserypos-staging.140-238-251-141.sslip.io`.
  Get a token with `POST /api/auth/login {"phone": "...", "password": "..."}` and send `Authorization: Bearer <token>`.

**Before you start**
- Use fresh test shops for anything that changes data. Don't run destructive tests on the demo shop (Green House).
- Have ready: 5 plant photos (one blurry, one of a pot, one of a person), a photo of a printed supplier bill,
  a 15 MB photo, a PDF file renamed to `.jpg`, and two phones (or a phone and the browser) for the "two at once" tests.
- You need 3 phone numbers you control: owner A, owner B (second shop), worker W.

Mark each row ✅ or ❌. For ❌, write what you saw and take a screenshot. **P** = priority: 1 must pass to release,
2 should pass, 3 nice to have.

**Release / build:** ______ **Date:** ______ **Tester:** ______

## Found while writing these
Fixed already (re-check them): **D.13** the order cart was shared between logins on one phone;
**P.12** searching customers or bills for text like `+91` or `(` crashed the server search.

Known limits, so a ❌ here is "expected for now". Decide if any must change before launch:
1. A worker's tabs update only after they reopen the app when the owner changes their permissions. The server blocks them straight away (D.9).
2. Sign-up has no limit per day, so a stranger could make many shops. Each shop's AI scans are capped at 300 a day, but the total isn't (P.15).
3. If the owner changes a price while that item is in someone's open order, the order keeps the old price (G.19).
4. A number that isn't on WhatsApp gets WhatsApp's own "not on WhatsApp" message. The app can't check first (H.21).
5. Owners who signed up with phone + password have no "forgot password" self-service yet (B.12).
6. Billing needs internet. There's no offline mode (N.1).

---

## A. Install, open, update (phone)
| # | Steps | Expected | P | ✅/❌ | Notes |
|---|---|---|---|---|---|
| A.1 | Install the QA APK on a phone that has the real app | Both apps installed side by side ("NurseryPOS" and "NurseryPOS QA") | 1 | | |
| A.2 | Open the QA app the first time | Welcome screen in under 3 s, no error | 1 | | |
| A.3 | Turn on airplane mode, open the app | Welcome or Home shows; any action gives "No internet…" and no endless spinner or crash | 1 | | |
| A.4 | Log in, force-close the app, reopen | Still logged in, lands on Home | 1 | | |
| A.5 | After an over-the-air update is published to `staging`: close and reopen the app twice | New version is running (the change is visible) without reinstalling | 1 | | |
| A.6 | Check the real (prod) app after A.5 | Prod app did NOT get the staging update | 1 | | |
| A.7 | Uninstall and reinstall the QA app | Asks you to log in again; your shop's data is still there after login | 2 | | |

## B. Sign up and log in
| # | Steps | Expected | P | ✅/❌ | Notes |
|---|---|---|---|---|---|
| B.1 | Sign up: name, owner A phone, 8-character password | Goes to setup step 1 | 1 | | |
| B.2 | Sign up with the same phone again | "already has a login" style error; no second account | 1 | | |
| B.3 | Phone typed as `098111 22334`, `+91-98111-22334`, `9811122334` | All accepted as the same number | 2 | | |
| B.4 | Phone `5811122334`, `98111` or `98111223345` | Rejected with a clear message | 1 | | |
| B.5 | Password of 7 characters | Sign up button stays disabled or shows "at least 8" | 1 | | |
| B.6 | Name with Hindi, e.g. `सुरेश`, and an emoji 🌱 | Accepted; shows correctly everywhere later | 2 | | |
| B.7 | Log in with the right phone and a wrong password | "wrong phone or password" style error that doesn't say which part is wrong | 1 | | |
| B.8 | Wrong password 5 times, then the right one | 6th attempt is blocked: "Too many tries, wait 10 minutes" | 1 | | |
| B.9 | Wait 10 minutes after B.8, log in correctly | Works | 2 | | |
| B.10 | Log out | Back to Welcome; Android back button doesn't return into the app | 1 | | |
| B.11 | After logging out, phone back button / browser back | Never shows Home or another user's data | 1 | | |
| B.12 | Tap "Forgot password?" text | Explains to contact support / owner (known limit 5) | 3 | | |
| B.13 | Try to sign up as an owner using worker W's phone (after W exists) | Refused: number already has a login | 1 | | |
| B.14 | "Continue with Google" | Not shown yet (Google sign-in comes later) | 3 | | |

## C. Shop setup (owner, first time)
| # | Steps | Expected | P | ✅/❌ | Notes |
|---|---|---|---|---|---|
| C.1 | Step 1 with an empty name | Next disabled | 1 | | |
| C.2 | Step 1: add a logo from gallery, then change it | Logo preview updates; Next works | 2 | | |
| C.3 | Logo: pick the PDF renamed to .jpg, then the 15 MB photo | Clear error for the fake file; big photo is accepted (shrunk) or refused with a clear message; no crash | 2 | | |
| C.4 | Step 2: phone with 9 digits | Red error, Next disabled | 1 | | |
| C.5 | Step 3: GST on, GSTIN `06abcde1234f1z5` (lowercase) | Turns into capitals and is accepted | 2 | | |
| C.6 | Step 3: GST on, GSTIN `12345` or blank | Error shown / Next disabled | 1 | | |
| C.7 | Step 3: GST off | Step 4 shows no % on the chips | 1 | | |
| C.8 | Step 4: untick everything | Next disabled | 1 | | |
| C.9 | Step 4: on a small phone | List scrolls; Back and Next always visible at the bottom | 1 | | |
| C.10 | Kill the app on step 3, reopen | Comes back to setup with steps 1–2 already filled | 1 | | |
| C.11 | Back from step 4 to 1 and forward again | Typed values still there | 2 | | |
| C.12 | Done → "Add my products" / "Add a worker" / "Start selling" | Each opens the right screen; back button then goes to Home, never back into setup | 1 | | |

## D. Roles: what a worker can and can't do
Owner A adds worker W (Staff → Add worker). Test with W logged in on a second phone or the browser.

| # | Steps | Expected | P | ✅/❌ | Notes |
|---|---|---|---|---|---|
| D.1 | W logs in with phone + PIN | Home says "Hello, W" with "Worker" badge; tabs Home, Orders, Products, Customers, Me | 1 | | |
| D.2 | W's Home | Shows only W's own sales today, not the shop's | 1 | | |
| D.3 | W's Orders | Only bills W made; owner's bills never appear | 1 | | |
| D.4 | W opens a product | Price and stock shown; **no cost price** anywhere | 1 | | |
| D.5 | W's Me tab | Lists what W can do; no Staff, Shop details, Categories, Reports | 1 | | |
| D.6 | Owner turns off W's "Customers", W reopens the app | Customers tab gone | 1 | | |
| D.7 | Owner turns off all of W's permissions, W reopens | Only Home ("Billing is off for you") and Me | 2 | | |
| D.8 | Owner turns on "Sales reports" for W, W reopens | W sees Reports and all shop bills | 2 | | |
| D.9 | Owner removes "Make bills" while W is on the New order screen; W tries to pay | Payment fails with a "not allowed" message; no bill made (tabs update after reopen, known limit 1) | 1 | | |
| D.10 | Owner switches W off ("Can log in" off) | W's next action logs W out to Welcome; W can't log in again | 1 | | |
| D.11 | Owner sets a new PIN for W | W is logged out everywhere; old PIN fails, new PIN works | 1 | | |
| D.12 | W changes own PIN (Me → Change PIN) to 4 digits | Works; old PIN fails | 2 | | |
| D.13 | On one phone: owner adds 2 items to an order, logs out, W logs in | W's order is empty. W logs out, owner logs in: owner's 2 items are back | 1 | | |
| D.14 | W adds a product with "Add to products" | Saved; W can't set cost price; owner sees it | 2 | | |
| D.15 | W adds a new category while adding a product | Created with GST 0%; only the owner can change its GST | 2 | | |
| D.16 | W tries Products → Edit → Delete | No delete button for W | 1 | | |

## E. Products and stock
| # | Steps | Expected | P | ✅/❌ | Notes |
|---|---|---|---|---|---|
| E.1 | Add product: type "money" | "From the shared picture library: Money Plant · मनी प्लांट"; picking it fills name + category | 1 | | |
| E.2 | Type a name you already have | "Already yours" with Add stock; tapping it opens that product | 1 | | |
| E.3 | "Create new" a pot with price ₹118, stock 5 in Pots (18%) | Saved; list shows ₹118 · Pots | 1 | | |
| E.4 | Create new with the same name as an existing product | (Known: allowed) check both show and can be told apart | 3 | | |
| E.5 | Price blank | Save disabled | 1 | | |
| E.6 | Price `0`, then price `1000000` | ₹0 allowed (free item); ₹10,00,000 shows Indian grouping everywhere | 2 | | |
| E.7 | Type `-5` or `abc` in price / stock | Only digits and a dot get in | 1 | | |
| E.8 | Stock `2.5` (e.g. kg of soil) | Saved; shown as 2.5 | 3 | | |
| E.9 | Very long name (120 characters) | Saves; list shows it on one line with "…"; bill wraps it | 2 | | |
| E.10 | Sell a product down to 0 | Stays in the list with a red "Out of stock" badge; counted in "Low stock" | 1 | | |
| E.11 | Low stock filter | Shows exactly the products at or below their "Warn me below" number | 1 | | |
| E.12 | Product → Add stock 10 | Stock +10; History shows "Added +10 · you · time" | 1 | | |
| E.13 | Remove more than in stock | Can't: stepper stops at stock, server refuses if forced | 1 | | |
| E.14 | Edit name, category, price, warn level | Saved; old bills keep the old name and price | 1 | | |
| E.15 | Edit → add own photo for a product that shows the shared picture | Own photo now shows; note changes to "Your own photo" | 2 | | |
| E.16 | Owner deletes a product | Gone from list and search; old bills still show it | 1 | | |
| E.17 | Search products in Hindi (`तुलसी`) and with odd spacing (`money   plant`) | Finds them | 3 | | |
| E.18 | 300+ products (use the demo shop) | List scrolls smoothly; search answers instantly | 2 | | |

## F. Shared picture library (admin)
| # | Steps | Expected | P | ✅/❌ | Notes |
|---|---|---|---|---|---|
| F.1 | Shop A adds "Snake Plant" with its own photo | Shop B adding Snake Plant sees that picture | 1 | | |
| F.2 | Admin (9654346434): More → Shared pictures | List of all library plants; filters work; "New" badge on F.1's picture | 1 | | |
| F.3 | Admin: "Looks good" on a New picture | Badge changes to Checked | 2 | | |
| F.4 | Admin: Remove a picture | Shops without their own photo show the plant icon again | 1 | | |
| F.5 | Admin: New photo for a plant | Replaces it for every shop that uses the shared picture | 2 | | |
| F.6 | Non-admin owner opens `/more/library` in the browser | Sent back to More; API returns 403 | 1 | | |
| F.7 | A shop's own photo after F.4/F.5 | Still shows its own photo | 2 | | |

## G. New order
| # | Steps | Expected | P | ✅/❌ | Notes |
|---|---|---|---|---|---|
| G.1 | Take a photo of a plant you have | "Plant found", right name, Sure match / Probably badge | 1 | | |
| G.2 | Photo from gallery | Same as G.1 | 1 | | |
| G.3 | Blurry photo / photo of a person | Says it can't tell, or "Not in your stock"; no crash | 1 | | |
| G.4 | Photo of a plant you don't have | "Not in your stock yet" with name filled | 1 | | |
| G.5 | Deny camera permission | Clear message to allow it in settings; app still usable with search | 1 | | |
| G.6 | Scan while offline | "No internet…"; back to the camera screen | 1 | | |
| G.7 | "Wrong plant? Search instead" | Back to camera + search | 2 | | |
| G.8 | Search 2+ letters | Results with price and stock; tap adds | 1 | | |
| G.9 | Found product with 3 in stock: try to pick 4 | Stepper stops at 3 | 1 | | |
| G.10 | Add the same product twice (2 + 1) | One line with 3 | 1 | | |
| G.11 | Found product out of stock | "Out of stock in the app" + "Sell anyway" (and "Add stock" for stock users) | 1 | | |
| G.12 | Not in stock → "Add to products": stock 1, order qty 2 | Error "at least 2"; can't save | 1 | | |
| G.13 | Not in stock → "Just sell it" ₹50 × 2 | Line shows "not from stock"; stock unchanged after paying | 1 | | |
| G.14 | Toggle on a 5-inch phone / narrow browser | "Add to products" / "Just sell it" fit inside their buttons | 1 | | |
| G.15 | Cart: remove a line, change quantities | Total updates right away | 1 | | |
| G.16 | Discount bigger than the total (₹5000 on ₹500) | Total becomes ₹0, never negative | 1 | | |
| G.17 | Discount `12.5` | Accepted; total shows paise | 3 | | |
| G.18 | Add items, force-close the app, reopen | Order still there | 1 | | |
| G.19 | Item in cart, owner changes its price on another phone, then pay | (Known limit 3) note which price the bill used | 2 | | |
| G.20 | Item in cart, owner deletes that product, then pay | Clear error "no longer in your products"; no bill; nothing taken from stock | 1 | | |
| G.21 | **Two at once:** product with 1 left; phone 1 and phone 2 both add it; both pay | Exactly one bill; the other gets "Only 0 … left in stock"; stock ends at 0, not −1 | 1 | | |
| G.22 | Order with 2 items where the 2nd has run out meanwhile | Payment fails; the 1st item's stock is NOT reduced | 1 | | |

## H. Payment and the bill
| # | Steps | Expected | P | ✅/❌ | Notes |
|---|---|---|---|---|---|
| H.1 | Pay Cash | Bill made straight away; "₹X paid · Cash · Bill INV-…" | 1 | | |
| H.2 | Pay UPI with a UPI ID set | QR with the amount; scan it with GPay/PhonePe/Paytm: right payee name and amount (don't pay) | 1 | | |
| H.3 | Pay UPI with no UPI ID in shop details | Bill made straight away as UPI | 2 | | |
| H.4 | On the QR screen: "Change payment method" | Back to Payment; no bill made | 1 | | |
| H.5 | Double-tap "Cash" fast / double-tap "Money received" | Only ONE bill | 1 | | |
| H.6 | Pay with the network off | Error; order kept; pay again online makes exactly one bill | 1 | | |
| H.7 | Customer number of a returning customer | "Anita · bought N times before" | 2 | | |
| H.8 | New number + name | Customer saved; appears in Customers | 1 | | |
| H.9 | Number with 9 digits | Payment buttons disabled | 1 | | |
| H.10 | Non-GST shop | No GST lines anywhere on screen or bill | 1 | | |
| H.11 | GST shop, Pot ₹118 @18% | "Includes GST 18% ₹18.00"; total ₹118 | 1 | | |
| H.12 | GST shop: 2 × Money Plant ₹199 (0%) + Pot ₹118 (18%), discount ₹50 | Total ₹466; "Includes GST 18% ₹16.26" | 1 | | |
| H.13 | Category GST changed after a sale | Old bill keeps the old %; new bills use the new % | 1 | | |
| H.14 | Bill numbers | Go up by one per bill: INV-0001, 0002…; a second shop starts its own INV-0001 | 1 | | |
| H.15 | Bill numbers with two phones billing at the same moment | No two bills share a number | 1 | | |
| H.16 | "Download" first time (phone) | Asks for a folder, opens on Downloads; "Saved Bill INV-….pdf"; file opens in a PDF viewer | 1 | | |
| H.17 | "Download" second time | No folder question; saved straight away | 2 | | |
| H.18 | Download on iPhone (later) / browser | iPhone: share sheet with "Save to Files". Browser: bill page opens with its own Download PDF button | 3 | | |
| H.19 | Open the downloaded PDF | Shop logo top-left, shop name, items, GST lines, total, amount in words, "PAID · method"; A5 size | 1 | | |
| H.20 | "Send bill on WhatsApp" with a customer number | Opens that customer's chat with the message and bill link | 1 | | |
| H.21 | WhatsApp with a number not on WhatsApp | (Known limit 4) WhatsApp's own message | 3 | | |
| H.22 | WhatsApp with no number | WhatsApp opens to choose a contact | 1 | | |
| H.23 | Open the bill link on a phone that isn't logged in | Bill page shows without login; logo, items, total | 1 | | |
| H.24 | Change one character in the bill link | "Bill not found" | 1 | | |
| H.25 | Product named `<b>Rose</b><script>alert(1)</script>` | Bill page and PDF show the text as typed; no popup | 1 | | |
| H.26 | Bill with 40 lines | PDF has page 2 with no cut rows | 2 | | |
| H.27 | Bill of ₹1,23,456.50 | "₹1,23,456.50"; words "One Lakh Twenty Three Thousand…and Fifty Paise" | 2 | | |
| H.28 | Bill screen → "Next order" / "Back to home"; then phone back | Next order opens a fresh scan screen; back from Home never shows the old Payment screen | 1 | | |

## I. Home, Orders, Reports
| # | Steps | Expected | P | ✅/❌ | Notes |
|---|---|---|---|---|---|
| I.1 | After 3 bills (Cash ₹100, UPI ₹200, Card ₹300) | Today ₹600, 3 orders, Cash/UPI/Card split right | 1 | | |
| I.2 | Bill at 11:58 pm and 12:02 am (phone time India) | Land on different days in Orders and Reports | 2 | | |
| I.3 | Phone set to another time zone | "Today" still means today in India | 3 | | |
| I.4 | Orders: tap each day chip | Totals match that day's bills | 1 | | |
| I.5 | Reports Today / Week / Month | Totals equal the sum of the bills in Orders for those days | 1 | | |
| I.6 | Profit | Counts only items with a cost price; says "about" | 2 | | |
| I.7 | Best sellers | Top 5 by quantity | 2 | | |
| I.8 | Brand-new shop | Friendly empty states everywhere; nothing shows NaN, undefined or ₹NaN | 1 | | |
| I.9 | Pull down to refresh on Home, Orders, Products, Customers | Updates without leaving the screen | 2 | | |
| I.10 | Huge sales day (₹12,34,567) | Amount fits on one line (shrinks); no overlap | 2 | | |

## J. Customers
| # | Steps | Expected | P | ✅/❌ | Notes |
|---|---|---|---|---|---|
| J.1 | Add customer with an existing number | "already exists" error | 1 | | |
| J.2 | Add customer with no phone | Saved; shows "No phone"; no Call/WhatsApp buttons | 2 | | |
| J.3 | Search by name part and by last 4 digits | Finds them | 2 | | |
| J.4 | Customer page | Total bought and visits match their bills; past bills open | 1 | | |
| J.5 | Call / WhatsApp buttons | Open the dialer / chat with the right number | 2 | | |

## K. Staff (owner)
| # | Steps | Expected | P | ✅/❌ | Notes |
|---|---|---|---|---|---|
| K.1 | Add worker with a 3-digit PIN | Save disabled | 1 | | |
| K.2 | Add worker with owner A's or another shop's number | "already has a login" | 1 | | |
| K.3 | "Save and send login on WhatsApp" | WhatsApp opens to the worker with phone + PIN + how to log in | 2 | | |
| K.4 | Change permissions, then save without a new PIN | Saved; worker NOT logged out | 2 | | |
| K.5 | Switch worker off, then on again | Off: can't log in. On: can log in with the same PIN | 1 | | |

## L. Shop details and categories
| # | Steps | Expected | P | ✅/❌ | Notes |
|---|---|---|---|---|---|
| L.1 | Change shop name | New name on Home and on new bills | 1 | | |
| L.2 | Change logo | New logo on Home (top-left) and on bills/PDFs | 1 | | |
| L.3 | Wide logo (banner shape) and a tall logo | Whole logo visible, not cropped, on Home and the bill | 2 | | |
| L.4 | GST on → off | New bills have no GST; old bills unchanged | 1 | | |
| L.5 | Rename a category to an existing name | "already have a category with this name" | 2 | | |
| L.6 | Change a category's GST (5%, 18%, 40%) | Products in it show the new % immediately | 1 | | |
| L.7 | Delete a category that has products | Refused with how many products use it | 1 | | |

## M. Supplier bill
| # | Steps | Expected | P | ✅/❌ | Notes |
|---|---|---|---|---|---|
| M.1 | Photo of a clear printed bill | Items listed; matched ones say "Adds to X", others "New product" | 1 | | |
| M.2 | Blurry bill / photo of a plant | "No items found…" and you can type them | 2 | | |
| M.3 | Edit a quantity and cost, remove a line, add a line | Saved values used; removed line not added | 1 | | |
| M.4 | Save | Stock goes up; History shows "Supplier bill"; new products created at cost + 60% | 1 | | |
| M.5 | Worker saves a supplier bill | Stock added; cost prices NOT changed | 2 | | |

## N. Tough conditions (phone)
| # | Steps | Expected | P | ✅/❌ | Notes |
|---|---|---|---|---|---|
| N.1 | Network off in the middle of each flow (scan, save product, pay, add worker) | Clear error, nothing half-saved, retry works | 1 | | |
| N.2 | Slow network (phone hotspot on 2G) | Spinners on buttons, no double saves, no frozen screens | 1 | | |
| N.3 | Server down (ask Claude to stop staging for 2 minutes) | Errors, then everything works again without reinstalling | 2 | | |
| N.4 | Phone back button on every screen | Goes to the previous screen; from Home exits the app; never to Welcome/Login when logged in | 1 | | |
| N.5 | Small phone (5", 360 dp wide) | Nothing cut off or overlapping on any screen | 1 | | |
| N.6 | Phone Settings → Display: largest font + largest display size | Text bigger but no overlaps; buttons still tappable | 1 | | |
| N.7 | Dark mode on the phone | App stays light and readable | 2 | | |
| N.8 | Leave the app on Home for 30 min, come back | Numbers refresh when you return to the tab | 2 | | |
| N.9 | Hindi keyboard typing in every text box | Text appears correctly | 2 | | |
| N.10 | Phone storage almost full, then Download a bill | Clear error, no crash | 3 | | |

## P. Security and abuse (API, staging only)
| # | Steps | Expected | P | ✅/❌ | Notes |
|---|---|---|---|---|---|
| P.1 | Any `/api/...` call without a token (except sign up / log in) | 401 | 1 | | |
| P.2 | Token with one changed character; token signed with "none" | 401 | 1 | | |
| P.3 | Owner B's token: GET owner A's product, bill, customer by id | 404 (never A's data) | 1 | | |
| P.4 | Owner B's token: PUT/DELETE A's product, PATCH A's worker, PATCH A's category | 404, nothing changed | 1 | | |
| P.5 | Worker token: GET `/api/staff`, `/api/reports/sales`, PUT `/api/business` | 403 | 1 | | |
| P.6 | Worker token: POST `/api/products` with `cost_price: 999` | Saved with cost 0 | 1 | | |
| P.7 | Worker token: POST `/api/categories` with `gst_percent: 18` | Saved with 0% | 2 | | |
| P.8 | Worker token: GET `/api/products` | No `cost_price` field in the reply | 1 | | |
| P.9 | Invoice with quantity `-1`, `0`, price `-5`, or 0 items | 422, no bill | 1 | | |
| P.10 | Invoice with a product id from another shop | 400, no bill, other shop's stock untouched | 1 | | |
| P.11 | Category GST `7` | 400 "GST must be one of…" | 2 | | |
| P.12 | `/api/customers?search=(` and `/api/invoices?search=+91` | 200 (no server error) | 1 | | |
| P.13 | Upload 9 MB image / text file as image | Clear 4xx error | 1 | | |
| P.14 | AI scan 301 times in a day (staging `AI_DAILY_LIMIT` can be lowered for the test) | 301st gets 429 "Today's AI scan limit is reached…" | 2 | | |
| P.15 | Sign up 20 shops in a minute | (Known limit 2) note: all succeed today | 2 | | |
| P.16 | `/i/abc` and a random 22-character token | 404 "Bill not found"; page is not indexed (noindex) | 2 | | |
| P.17 | `/api/files/../../etc/passwd` | 4xx, never a file from the server | 1 | | |
| P.18 | Old token after the user changed password | 401 | 1 | | |

## Q. Demo shop (Green House, 9654346434)
| # | Steps | Expected | P | ✅/❌ | Notes |
|---|---|---|---|---|---|
| Q.1 | Log in, look at Home in the afternoon | Today has orders and sales; list of recent orders | 1 | | |
| Q.2 | Wait 15–30 min, refresh Home | New orders appear (shop hours 9 am–8:30 pm) | 1 | | |
| Q.3 | Products | 25 plants + 15 other products + your own; some "Low stock", Fiddle Leaf Fig "Out of stock" | 1 | | |
| Q.4 | Reports Month | A full month of sales with profit and best sellers | 1 | | |
| Q.5 | Next morning | Stock topped up; showcase items still low/out; old orders still there | 2 | | |
| Q.6 | Your own products and bills (e.g. Kopi Plant) | Never changed by the demo | 1 | | |
| Q.7 | Demo customers' WhatsApp | Don't send: their numbers are dummies (+91 90000 001xx) | 1 | | |

## R. Release to production (after staging passes)
| # | Steps | Expected | P | ✅/❌ | Notes |
|---|---|---|---|---|---|
| R.1 | Before merging to `main`: prod `.env` has JWT_SECRET, PUBLIC_BASE_URL, ADMIN_PHONES, AI_DAILY_LIMIT | All set (Claude checks names only) | 1 | | |
| R.2 | Prod data wipe done if wanted | Prod database empty except the shared library | 1 | | |
| R.3 | After deploy: sign up on prod, one bill end to end | Works; bill link uses the prod address | 1 | | |
| R.4 | Old prod APK users | Must install the new prod app (old one stops working) | 1 | | |
