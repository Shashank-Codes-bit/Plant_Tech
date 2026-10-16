# NurseryPOS QA checklist

Run this on a real Android phone before every release.
- **Prod:** use the "NurseryPOS" app.
- **Staging:** use the "NurseryPOS QA" app.

Mark each row ✅ or ❌. For any ❌, write what you saw in Notes and take a screenshot.

Before you start:
- Have a few plant photos and a photo of a printed supplier bill on the phone.
- Note today's Home stats so you can check they change.

**Release / build:** ______ **Date:** ______ **Tester:** ______

## 1. Start-up
| # | Steps | Expected | ✅/❌ | Notes |
|---|---|---|---|---|
| 1.1 | Open the app | Home appears in under 3 s, with your nursery name in the greeting | | |
| 1.2 | Turn on airplane mode, pull down to refresh Home, then turn it off | A clear error appears (no endless spinner); everything works again afterwards | | |

## 2. Home
| # | Steps | Expected | ✅/❌ | Notes |
|---|---|---|---|---|
| 2.1 | Look at "Today" | Sales, Bills, Items Sold and Cash all show numbers | | |
| 2.2 | Look at Low Stock | Products at or below their minimum stock are listed | | |
| 2.3 | Tap each of: Scan Plant, New Bill, Add Inventory, Scan Invoice | Each opens the right screen; back returns to Home | | |

## 3. Scan Plant (selling)
| # | Steps | Expected | ✅/❌ | Notes |
|---|---|---|---|---|
| 3.1 | Scan Plant → Take Photo of a plant that **is** in stock | Name, confidence and the matched product with price appear in under 10 s | | |
| 3.2 | Change quantity → Add to Cart | "Added to cart"; the cart badge goes up | | |
| 3.3 | Scan Next → Gallery → pick a plant photo | Works the same as with the camera | | |
| 3.4 | Scan a plant that is **not** in stock | A "not in stock" screen with options appears; **you stay in the billing flow** (you don't land on Home) | | |
| 3.5 | Scan something that isn't a plant (e.g. a cup) | Low confidence or "couldn't identify"; Retake works | | |

## 4. Add Inventory
| # | Steps | Expected | ✅/❌ | Notes |
|---|---|---|---|---|
| 4.1 | Inventory → Add → Take Photo | The photo shows in the form; **no "upload failed" message** | | |
| 4.2 | Identify with AI | The name (and botanical name) are filled in | | |
| 4.3 | Enter prices, stock and category → Save | The product appears in Inventory **with its photo** | | |
| 4.4 | Open the product → Edit → change price → Save | The new price shows | | |
| 4.5 | Open the product → Adjust Stock → Add 5, reason Purchase | Stock goes up by 5 and shows in stock history | | |

## 5. Billing and payment
| # | Steps | Expected | ✅/❌ | Notes |
|---|---|---|---|---|
| 5.1 | Billing → Search → add 2 different products | Both are in the cart with photos and prices | | |
| 5.2 | Use + / − and the trash button | Quantities and total update; the item is removed | | |
| 5.3 | Enter a discount | The grand total drops by the discount | | |
| 5.4 | Collect Payment → enter a customer name and 10-digit phone → Cash | The invoice screen appears with "Payment Complete"; the cart is empty | | |
| 5.5 | Go to Inventory | Stock of the sold products went down | | |
| 5.6 | Try to sell more than is in stock | A clear "Not enough stock" message; nothing is charged | | |
| 5.7 | Repeat a sale with UPI and with Card | The invoice shows the right payment method | | |

## 6. Invoice
| # | Steps | Expected | ✅/❌ | Notes |
|---|---|---|---|---|
| 6.1 | On the invoice screen, check the details | Shop name, invoice number, date, items, totals and PAID are correct | | |
| 6.2 | Share Invoice → WhatsApp → pick a chat | A PDF arrives in that chat and opens correctly | | |
| 6.3 | More → Invoice History → search by number or customer | The invoice is found and opens | | |

## 7. Customers
| # | Steps | Expected | ✅/❌ | Notes |
|---|---|---|---|---|
| 7.1 | Customers → open the customer from 5.4 | Total spent and bill count include that sale | | |
| 7.2 | Tap the phone number | The phone dialler opens | | |
| 7.3 | Add Customer → Save | They appear in the list | | |

## 8. Scan Purchase Invoice
| # | Steps | Expected | ✅/❌ | Notes |
|---|---|---|---|---|
| 8.1 | More → Scan Purchase Invoice → photo of a supplier bill | The supplier, invoice number and items are read in under 30 s | | |
| 8.2 | Edit an item's quantity → Add to Inventory | "Inventory updated"; stock of the matched products goes up, and new items are created | | |

## 9. Settings
| # | Steps | Expected | ✅/❌ | Notes |
|---|---|---|---|---|
| 9.1 | More → Categories → add one, then delete it | It's added and then removed | | |
| 9.2 | More → Business Info → change the phone → Save | The new phone shows on the next invoice | | |
| 9.3 | Turn tax on at 5% → make a sale | The invoice shows a 5% tax line | | |

## 10. General
| # | Steps | Expected | ✅/❌ | Notes |
|---|---|---|---|---|
| 10.1 | Use the app outdoors in sunlight | All text is readable | | |
| 10.2 | Close the app with items in the cart, then reopen | The cart is still there | | |
| 10.3 | Anything confusing, slow or ugly? | Note it here, because it feeds into the UI revamp | | |

## After testing on prod
Test sales, customers and stock changes stay in the live database. Before real customers use the app, ask for a cleanup. A backup is taken first, then the test invoices, test customers and demo products are removed.
