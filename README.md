# محصول فاخر · Luxury Crop — Digital Menu + Admin Dashboard

A premium, mobile-first, **Arabic-first (RTL)** digital QR menu for **Luxury Crop / محصول فاخر** (specialty coffee, Taif), plus a separate **admin dashboard** to manage it. Pure HTML/CSS/JS — **no backend, no build step**. Open the files and it runs.

Built by **Mutawafiq / متوافق** — SFDA-compliant QR menus.

---

## 1. What's in the box

```
luxury-crop-menu/
├─ index.html         # the customer menu
├─ admin.html         # the management dashboard
├─ data/menu.json     # single source of truth (categories, items, prices, allergens, nutrition)
├─ assets/logo.jpg    # the Luxury Crop logo
├─ css/
│   ├─ menu.css        # customer menu styles
│   └─ admin.css       # dashboard styles
├─ js/
│   ├─ icons.js        # shared inline-SVG icon set (UI + 14 allergens)
│   ├─ menu.js         # customer menu logic
│   └─ admin.js        # dashboard logic
├─ build-menu.js      # (dev) regenerates data/menu.json from the crawled catalog
├─ server.js          # (dev) tiny static server for local preview
└─ README.md
```

The menu and the dashboard **both read the same `data/menu.json`**. There is one source of truth.

---

## 2. Running it locally

The page uses `fetch()` to load `data/menu.json`, so it must be served over **HTTP** (not opened as a `file://` path, which browsers block).

```bash
node server.js      # → http://localhost:5050  (menu)
                    # → http://localhost:5050/admin.html  (dashboard)
```

Any static server works (`npx serve`, VS Code Live Server, Python's `http.server`, etc.). For production, just upload the folder to any static host (GitHub Pages, Netlify, Cloudflare Pages…). No server code required.

---

## 3. Editing the menu (the dashboard)

Open **`admin.html`**. It's clarity-first and works on phone or desktop.

- **Categories** (right pane): select, add (`+ قسم`), edit (✏️), delete, and **drag ⋮⋮ to reorder**.
- **Items** (middle pane): for the selected category — add (`+ صنف`), edit (✏️), delete (🗑️), quick **availability toggle** (✓/eye), and **drag ⋮⋮ to reorder**.
- **Item editor** (slide-over): Arabic + English name & description, **price (SAR)**, estimated calories, estimated caffeine, optional image URL, the **14 allergens** (tap to toggle), **high-sodium** flag, and **availability** (off = hidden from the public menu).
- **Live preview** (left pane, desktop): an embedded copy of the real menu that **refreshes after every edit**.

### How data persists
- Every change is **auto-saved to your browser's `localStorage`** (key `luxurycrop.menu`). Reopening the dashboard or the menu on the same browser keeps your edits.
- `localStorage` is **per-browser/per-device**. To make edits permanent for everyone, **export and publish** (next section).

### Export / Import (portable + permanent)
- **`تصدير JSON`** downloads your current menu as `menu.json`.
- **`استيراد`** loads a `menu.json` file back in (validated first — see security).
- **`استعادة`** discards your local edits and restores the original `data/menu.json`.

**To publish edits for real customers:** edit in the dashboard → **Export JSON** → replace `data/menu.json` in the hosted folder with the downloaded file → re-upload. (With Mutawafiq's current service, you just send the changes on WhatsApp and we publish them.)

---

## 4. The data: `data/menu.json`

- **9 categories, 50 items**, crawled from the café's old menu (`luxury-crop.easymenu.site`) — **names, descriptions and prices only**. The design is entirely ours.
- Currency is **SAR**. Prices are integers exactly as on the source.
- The old menu had **no English, no allergens, and no calories/caffeine** — so:
  - **English** names & descriptions were authored for the AR/EN toggle.
  - **Allergens** are **inferred from ingredients** and flagged `"allergens_confirmed": false` — *please review them in the dashboard before final publish.*
  - **Calories & caffeine** are **estimates** (`"nutrition_estimated": true`), shown with an on-menu disclaimer; the café confirms the real figures.
- Anything genuinely unknown is left as a clear `"TODO"` (e.g. the brand's `maps` / `tiktok` links are empty until provided — the menu hides them gracefully).

Regenerate `data/menu.json` from the crawled catalog at any time with `node build-menu.js`.

---

## 5. Features

**Customer menu** — RTL Arabic ⇄ LTR English toggle · 5 top entry points (rating, allergens, info, location, contact) · scroll-synced category nav · search + filters (all / under 150 kcal / caffeine-free) · per-item SFDA badges (calories, caffeine, allergens, high-sodium) · 14-allergen reference · Instagram/TikTok/Maps · SFDA compliance strip · calm, silk-like motion (IntersectionObserver reveals, eased transitions, `prefers-reduced-motion` honored).

**Dashboard** — full CRUD for categories & items · drag-to-reorder · allergen editor · availability toggle · live preview · localStorage + JSON export/import.

---

## 6. Security notes (threat model & mitigations)

The café (or an imported file) supplies the menu data, and the public menu renders it. The risks and how they're handled:

| Threat | Mitigation |
|---|---|
| **XSS via item names/descriptions** | Every café-supplied string is escaped (`esc()` → `& < > " '`) before it touches the DOM, in **both** the menu and the dashboard. No raw data is ever injected as markup. |
| **Malicious / malformed `menu.json` import** | Imports pass through `normalizeMenu()`, which validates the shape (rejects if `categories` isn't an array), **coerces types**, **clamps string lengths**, **filters allergen keys** to the known 14, drops unknown fields, and only accepts `http(s)`/`assets/`-relative image & link URLs. File size is capped (3 MB). |
| **Unsafe URLs (`javascript:` etc.)** | All links (social, maps, image) go through `safeUrl()` — only `https:`/`http:`/`mailto:`/`tel:` pass; anything else is dropped. |
| **`localStorage` errors / quota** | All reads/writes are wrapped in `try/catch`; failures degrade gracefully to the bundled `data/menu.json`. |
| **Code injection** | No `eval`, no `new Function`, no inline event handlers — all events are wired via `addEventListener` delegation. |
| **CSP** | Both pages ship a **Content-Security-Policy** meta with a strict `script-src 'self'` (no inline/remote scripts), plus locked-down `img/font/connect/frame/object/base` directives. |
| **Admin code leaking into the public menu** | `admin.js` is loaded **only** by `admin.html`. The public `index.html` contains no editing logic. `admin.html` is marked `noindex,nofollow`. |

> Note: the dashboard is a **client-side editor** with no auth — it's meant to be kept private (don't link it publicly). Treat the exported `menu.json` as the publish artifact.

---

## 7. Customization quick-reference

- **Brand / colors:** `data/menu.json → brand` (logo, rating, location, socials, theme). The palette (white · near-black · red `#e1352b`) is pulled from the logo and lives as CSS variables at the top of `css/menu.css`.
- **Fonts:** Cairo + Tajawal (Arabic), Poppins (Latin) via Google Fonts.
- **Add Maps/TikTok:** fill `brand.maps` / `brand.tiktok` in `data/menu.json` (or via export after editing) and the links appear automatically.
