# NurseryPOS — Product Requirements Document

## Original Problem Statement
Mobile-first app (Android + iOS) for plant nursery owners/staff (non-technical, older users, outdoors, bright sunlight, gloves). Philosophy: "No nonsense. Minimum taps. Maximum usefulness." Core loop: **SCAN → IDENTIFY → CART → PAY → INVOICE → STOCK UPDATED**. Photo-to-Bill AI is the flagship differentiator.

## User Choices (locked)
- AI model: **Gemini 3 Flash** (`gemini-3-flash-preview`) via Emergent Universal LLM Key
- Auth: **Simple local business setup, NO password**
- Currency: **Indian Rupee ₹**, tax optional/off by default
- Product photos: **Emergent Managed Object Storage**
- Same AI model used for supplier purchase-invoice OCR

## Architecture
- **Frontend**: Expo Router (React Native), @tanstack/react-query, react-native-safe-area-context, expo-image-picker (camera+gallery), expo-image, expo-print + expo-sharing (invoice PDF share), @react-native-vector-icons/material-design-icons. Theme in `src/theme.ts` (dark-green brand, high-contrast, light-only). Cart state in `src/cart-context.tsx` (persisted to storage). Toasts in `src/components/toast.tsx`.
- **Backend**: FastAPI + MongoDB (Motor). Modules: `server.py` (models + routes), `ai_client.py` (Gemini identify + OCR), `storage_client.py` (object storage), `seed.py` (sample data). All routes `/api` prefixed. Stock changes recorded in `stock_history`. Sales decrement stock with a manual rollback loop (tested).
- Navigation: Bottom tabs **Home | Billing | Inventory | Customers | More**; stack modals for Scan, Payment, Scan Invoice, forms, detail screens.

## User Personas
1. **Nursery owner** — sets up business, checks daily sales & low stock, adds inventory, scans supplier bills.
2. **Counter staff** — scans plants at the counter, builds a bill, takes cash, prints/shares receipt fast.

## Core Requirements (static)
Product/inventory DB · Add inventory · Product search · AI plant ID · AI→product matching · Multi-product cart · Billing · Cash payment · Auto stock reduction on sale · Customers · Invoice generation + history · Purchase-invoice OCR + stock increase · Low-stock surfacing · Dashboard.

## Implemented (2026-09-22 — MVP)
- ✅ Business setup + edit (Business Info screen) — no password
- ✅ Home dashboard: greeting, Scan Plant + New Bill heroes, Add Inventory + Scan Invoice, Today stats (sales/bills/items/cash), Low Stock cards
- ✅ AI Plant Scanner: camera/gallery → Gemini identify → confidence + alternatives → matched inventory product → quantity → Add to Cart; manual fallback (Search / Add as New / Retake)
- ✅ Product Search → add to cart
- ✅ Multi-product Cart: steppers, remove, discount, tax, grand total
- ✅ Payment: Cash/UPI/Card + optional customer capture/save → invoice created, stock decremented, cart cleared
- ✅ Invoice/receipt screen with PAID badge + PDF Share (WhatsApp/print via share sheet)
- ✅ Invoice History (searchable)
- ✅ Inventory list: search, category chips, low-stock badges; Product Detail with stock + sales history; Adjust Stock modal (reasons); Add/Edit Inventory with photo upload + AI identify
- ✅ Scan Purchase Invoice: Gemini OCR → editable review → confirm → increases/creates stock
- ✅ Customers list/detail (call, purchase history, totals) + Add Customer
- ✅ Categories management
- ✅ AI Insights — "Coming Soon" placeholder (reserved in nav)
- ✅ 12 categories + 18 seeded sample products (some low-stock for demo)
- ✅ Emergent Object Storage for photos; transactional-ish stock updates with rollback

## Backlog
### P1
- WhatsApp deep-link share of invoice (currently system share sheet)
- Real UPI/Card gateway integration (structure ready; MVP records the method)
- Supplier management screens; store scanned invoice image gallery
- Offline cache / draft invoices / Online-Offline indicator + sync

### P2 / P3
- AI Insights: best-sellers, slow movers, restock suggestions, seasonal demand, pricing, forecasting
- Split `server.py` into resource-scoped routers; MongoDB session transaction for invoice under high concurrency

## Notes
- Camera & PDF share require a real device/build; web preview cannot open the camera.
- Deploy via Publish button; builds via Publish flow.
