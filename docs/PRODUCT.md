# eazmybiz — Product specification

Single source of truth distilled from product planning. Update this file when scope changes.

## 1. Overview

**eazmybiz** is a web portal for day-to-day business operations, promoted by **Televers Networks Private Limited**, New Delhi, India. In-app **Terms & Conditions** and **Privacy Policy** are at `/terms` and `/privacy`, linked from the public home page, sign-in, sign-up, and onboarding.

| Module | Description |
|--------|-------------|
| Quotation | Customer quotes (billing address on forms; **Bill to** on print/PDF, line items, GST %, delivery period, validity date, terms, bank on PDF). **Valid until** (default): **7** days after **quotation date** or **7** days after **organization-calendar today**, whichever is **later**. **Document date** (optional): same **organization-calendar** backdating limits and admin notifications as packing list / delivery challan (see delivery challan row). |
| Packing list | Shipments and line items. **Document date:** same organization-calendar backdating and notification rules as quotation / delivery challan. |
| Delivery challan | Issued delivery documentation (goods; **HSN** per line; **Billing** & **shipping addresses** required in app; **Bill to** / **Ship to** on print/PDF; PO / LR / e-way / transporter / vehicle meta on print; **company terms** (editable under company profile, defaults E&OE + jurisdiction line) and **bank details** (same block as quotation) on print/PDF above **Received by** / **For** *consigner name* acknowledgement). **Quotation, packing list, and delivery challan** share a **document date** rule tied to the **organization calendar** (see section 4.0): members may set the date up to **7** days in the past; **company admins** and the **account owner** may set it up to **30** days in the past. **No document date after “today”** in that calendar may be **prepared or issued**. Any **document date** strictly **before today** (organization calendar) is logged for **admin/owner** visibility under **Notifications**. **Issue** time (`issued_at`) is always **current server time** when a document is issued (never backdated). Duplicating a challan resets the document date to **organization today**. |
| Material gate pass | In/out at premises: **pass date** (organization calendar; **no backdating** — **today or a future day**, up to **15** days ahead, same idea as visitor **visit date** in section 4.0), **invoice or DC no.** (required), party (search or type), **either** courier/transport (name or LR/AWB) **or** hand-carried (name + mobile), optional **vehicle no.** (transporter or hand-carried), **packages ≥1**, main item, optional notes; save draft (returns to list), open from list to edit/issue; **print** uses **A5 portrait**; issue opens print (quota on issue). **Issue** and **record material movement** are only allowed **on or after the pass date** in that calendar (drafts may target a future day). **Record material movement** (after issue) is also limited to **within 48 hours** of issue time. **Issued** passes with **no** movement recorded for **more than 24 hours** after issue are **highlighted** on the list and detail (same red emphasis style as visitor overdue check-out). |
| Visitor management | Visitors, check-in/out, passes |

**Drafts (quotation / packing list / delivery challan):** The creator (or anyone who can see the row) may **delete** a **draft**. On delete, the app **only** rolls back the per-series counter when this draft’s serial is still the **last** one allocated in that series; if higher numbers already exist, the counter stays put so **new** documents never “reuse” a middle serial. While a **draft** is edited, **numbering series** may be changed when **multi-series** is on (the old number is released with the same last-serial rule, then a new number is taken from the chosen series). **Duplicate** copies the source row’s series when known; otherwise use **Edit** on the copy to pick another series.

**Parties (masters):** Each **party** has one **billing address** and up to **three** **shipping addresses**. Users maintain them on the **Parties** screen; packing lists, quotations (billing only), and delivery challans can **save as party** or **load party** into the form. **Edit rights:** changing the **party name** or **billing address** requires the **party maintainer**, a **company admin**, or the **account owner** for that company. **Shipping addresses** may be added or changed by **any org member** who has **Parties** access; when a member outside that maintainer/admin/owner set makes a shipping-related change, it is **recorded** on the party detail screen under **Activity**. When billing and shipping snapshots match, one checkbox saves both (billing + first shipping slot). **Print/PDF** for quotation, packing list, and delivery challan still label these blocks **Bill to** / **Ship to** as today. The database stores an optional **`party_id`** on those three document types and on **material gate passes** for strict linkage (not always shown in the UI); **Load party** / **save as party** maintain it where applicable. Older rows with no link may still appear on the party detail screen when names/GSTIN match. **Deleting** a party is blocked while any related quotation, packing list, delivery challan, or gate pass exists (including by **party_id** or legacy matching **party name** on gate passes). **Party detail:** Edit-party shipping cards are titled **Shipping Address 1 (default)**, **Shipping Address 2**, **Shipping Address 3**. **Print address labels** opens a print view with **Ship To** on top (dropdown defaults to **billing address**; optional **Shipping Address 1–3** with the same naming) and **Shipped From** (organization address) below; paper options include **A4 portrait** (default), **A5 portrait**, and **100×150 mm thermal** (one label per section, two print pages). **Free** plan includes **Powered by eazmybiz** on these labels (Pro/Max omit it).

**Visitor pass (MVP):** **Required:** **visit date** (calendar day in the **organization calendar**; **no backdating** — must be **today or a future day** in that calendar, up to **15** days ahead), visitor name, India **10-digit mobile**, **host**. **Optional:** visitor company, purpose, vehicle number, driver name, photo (camera or file). **Print:** **ISO ID-1** wallet card (**company logo** when set) **or** **A5 portrait** foldable badge (fold along the marked line: **front** — organization name, optional address, logo, and visitor details; **no GSTIN** on visitor passes; **back** — rules and footer); **default layout** at the **bottom** of **company profile** (document numbering above it), overridable on the print preview. **Company name** at top on ID-1; **visit date** on the pass; **rules** (wear/display pass in premises; return pass to admin/host/security) on ID-1 footer or A5 back. Pass must be **issued** before print. An **issued** pass whose **visit date is still in the future** (organization calendar) may be **edited and saved** (including photo) until that day; **check-in** / **check-out** rules below are unchanged. On the **visit day**, before check-in, **visit date, visitor name, host, and purpose** are **fixed**; **visitor desk** may add or change **photo**, **vehicle**, and **driver** in the **Gate check-in** block on the **visit detail** screen, then use **Check-in & Print Pass** there (after reviewing gate fields). From the **today** list, **Check-in & print** opens that visit with the gate section in view instead of checking in immediately. **Check-in** still records arrival and then opens the pass in a print window. Check-in is allowed **only on the visit date** (not before; if the visit date has passed without check-in, check-in is no longer available). **Check-out** is labeled **Collect pass & Check-out** and is allowed **within 24 hours** of check-in; after that window, self-serve check-out is disabled. After **checked out**, **Print pass** is hidden on the detail screen and the print URL does not render the card (re-print only while **checked in**). **Visitors list** groups rows into **today** (visit date), **next five days** (visit date after org today), **checked out in the previous five organization-calendar days** (by check-out timestamp), then **other** (everything else). **Checked in** with no **check-out** for **more than 24 hours** since check-in is highlighted **red** on lists and on the visit detail page.

**Clients:** Desktop and laptop are primary. **Mobile:** PWA first; native Android/iOS may follow.

**Positioning:** Simple, professional templates; optional upgrade path to Pro/Max and later **Advanced** (customer-managed deployment).

---

## 2. Plans and entitlements

### 2.1 Summary

| Plan | Companies | Users | Notes |
|------|-----------|-------|--------|
| **Free** | 1 | Max **2** named users (office + gate) | Two distinct logins; roles recommended (see §5) |
| **Pro** | 2 | Up to **10** | Watermark-free customer-facing outputs; higher quotas; **Basic & Many More** document templates |
| **Max** | 5 | Up to **50** | Same product direction as Pro; highest quotas (incl. unlimited combined documents) |

**Advanced / Enterprise (future):** **Self-hosted or dedicated deployment** — same platform direction, separate licensing and ops. **Not** part of standard Free/Pro/Max checkout; leads **contact sales** (see §2.1.6).

#### 2.1.1 Full comparison (matrix)

| | **Free** | **Pro** | **Max** |
|--|----------|---------|---------|
| Companies | 1 | 2 | 5 |
| Users (max) | 2 | 10 | 50 |
| Company admin seats (subscription-wide, excl. account owner) | 0 | 2 | 5 |
| Company admins per company (excl. owner) | Not available | Max 1 | Multiple (within seat cap) |
| Deactivate members (Pro/Max) | No | Yes | Yes |
| Company logo on documents | Yes | Yes | Yes |
| Packing list print / PDF layouts | 1 (Basic) | 5 styles (Basic + Standard Pro + 3 Pro themes) | 8 (+ 3 Max-exclusive themes) |
| Monthly documents (combined) — quotation + packing list + delivery challan, **issued**, per company | 30 | 500 | Unlimited |
| Monthly gate passes (**issued**) | 60 | 500 | 2,000 |
| Monthly visitor passes (**issued**) | 60 | 500 | 2,000 |
| Quota reset | IST midnight, 1st of month | Same | Same |
| Hosted — tenant isolation | Yes | Yes | Yes |
| **Watermark-free customer-facing outputs** — no “Powered by eazmybiz” on PDFs, emails, gate passes, address labels, etc.; your brand stays front and centre | **No** | **Yes** | **Yes** |
| **Document numbers** — prefix + serial; dash vs slash before serial (paid) | Fixed **QT / PL / DC / GP / VP**; one reset schedule: **1 Jan**, **1 Apr**, or **custom month/day** yearly (counter bucket only) | Custom prefixes (**≤18** chars: letters, digits, **/**, **-**); continuous or yearly reset (does **not** append year/FY to the number—use the prefix for that); dash or slash; optional **3** independent numbering series (**company admin / account owner** only), per-type series assignment; **cannot change** a series’ reset rules after any document has been issued on that series | **Max:** optional **5** independent series (same rules as Pro) |

**Modules (today: all plans; future: some rows may be Pro/Max-only):**

| Module | Free | Pro | Max |
|--------|:----:|:---:|:---:|
| Quotation | ✓ | ✓ | ✓ |
| Packing list | ✓ | ✓ | ✓ |
| Delivery challan | ✓ | ✓ | ✓ |
| Material gate pass | ✓ | ✓ | ✓ |
| Visitor management | ✓ | ✓ | ✓ |
| Parties (masters) | ✓ | ✓ | ✓ |

#### 2.1.2 Incremental story (UI: Free → Pro → Max)

**Free — baseline:** 1 company · 2 users · **no** company-admin seats (account owner manages the team) · org logo · **Basic** templates · **30** combined issued documents/mo · **60** gate passes/mo · **60** visitor passes/mo · IST monthly reset · **document numbers:** fixed type prefixes (**QT**, **PL**, **DC**, **GP**, **VP**); admin picks **one** annual reset: **1 January**, **1 April**, or a **custom** month/day; numbering for a draft follows that document’s date for **which counter** is used; printed form is **prefix + serial** only (no auto year segment) · customer-facing outputs **include** Powered by eazmybiz (upgrade for watermark-free) · all modules listed above · hosted tenant isolation.

**Pro — everything in Free, plus / changed:** **2** companies · **10** users · **2** company-admin seats (max **1** admin per company) · **deactivate** members · **five** print/PDF document themes (**quotation**, **packing list**, **delivery challan** share the same set) · **500** combined documents/mo · **500** gate passes/mo · **500** visitor passes/mo · **custom document prefixes** (up to **18** characters per type: letters, digits, **/**, **-**), **series reset** (continuous, 1 Jan, 1 Apr, or custom annual date—counter only; no year injected into the printed number), **dash vs slash** before the serial, and optional **multiple numbering series** (**up to 3**, toggled by **company admin or account owner**): each document type is assigned to **series 1–N**; **Series 1** uses the main prefix fields; **Series 2+** may set **optional printed prefix overrides** per document type (same validation as main prefixes) so teams or departments can distinguish numbers on paper; each series has its own counter reset rules; **new** quotation / packing list / challan screens show a **preview** of the next document number and a **series** dropdown when multi-series is on; once a series has issued numbers, its reset rules are **locked** · **watermark-free** customer-facing outputs.

**Max — everything in Pro, plus / changed:** **5** companies · **50** users · **5** company-admin seats · **several** admins per company (within seat cap) · **eight** print/PDF document themes for quotation, packing list, and delivery challan (three additional **Max** themes) · **Unlimited** combined documents/mo · **2,000** gate passes/mo · **2,000** visitor passes/mo · same document numbering as Pro, with **up to 5** independent series when multi-series is enabled.

#### 2.1.3 Public pricing (checkout / pricing page)

- **Billing period:** **365 days** from **plan activation** (anniversary renewal unless product changes).
- **Regional display (logged-in / checkout):** Show **India** prices only when the **buyer context** is India; show **international** prices otherwise — **do not** show INR bundles to non-India contexts or USD bundles to India contexts on the same screen without a deliberate locale switch. *Implementation:* derive region from **organization `country_code`**, **`commercial_region`**, and/or **billing country** at payment — not from mixing both columns on one view without intent.
- **Anonymous marketing (`/pricing`):** For guests only, the app may choose **INR vs USD** using **edge IP country** (e.g. Vercel **`x-vercel-ip-country`**, Cloudflare **`cf-ipcountry`**). This is **UX only** (VPNs and proxies can mislead). Users may override with query **`?billing=in`** or **`?billing=intl`**; when the country cannot be inferred (e.g. local dev), **both** price lists may be shown. **Checkout** still validates commercial region.

| Plan | India (INR) | International (USD) |
|------|-------------|---------------------|
| **Free** | Free | Free |
| **Pro** | ~~₹3,999~~ **₹1,999** / year (50% off list) | ~~US$99~~ **US$49** / year (50% off list) |
| **Max** | ~~₹9,999~~ **₹4,999** / year (50% off list) | ~~US$199~~ **US$99** / year (50% off list) |

*List prices are for display (e.g. strikethrough + “50% off”); paid tiers charge the **sale** amount **plus applicable Indian GST** at INR checkout (currently **18%** on the pre-tax sale). Currency and tax handling follow integration rules.*

- **Pro to Max (INR) mid-term:** Charge is the Max annual **pre-tax** sale minus **pro-rata credit** for remaining Pro days (**IST** calendar; annual Pro sale ÷ 365), **never negative** (unused time cannot make the balance due go below zero). **GST** applies to the payable amount. If credit **fully covers** the Max sale, **self-serve checkout is not offered** — the customer **contacts support** to complete the upgrade. After payment (or a manual upgrade), **Max** is **365 days** from upgrade (new term).

#### 2.1.4 Commercial geography (where “companies” count)

- **India-priced subscription (INR):** Plan limits on **number of companies** (1 / 2 / 5) apply to **India-situated** businesses only. Each organization counted toward the limit must be the customer’s **Indian** legal / consigner entity: **`country_code` IN** and profile consistent with an **India** commercial seat (e.g. India address, India tax ID when applicable). The customer **must not** use India-priced seats to operate **only** non-Indian entities to obtain lower INR pricing; **terms of service** and **enforcement** apply (see §2.1.6).
- **International-priced subscription (USD):** The same **numeric** company limits (per plan tier) apply, but each counted organization may be **anywhere in the world**, **including India** (e.g. a global HQ on USD billing may include an Indian subsidiary as one of the orgs).

*Product and engineering should treat “pricing region” (INR vs USD) as the **commercial / billing** choice validated at checkout, not as something silently derived only from a self-serve profile field that can be edited without checks.*

#### 2.1.5 Pricing integrity — wrong country / wrong currency

**Risk:** Users mis-declare country to see or pay **INR** vs **USD** incorrectly.

**Principle:** **Checkout and payment** are the system of record for **commercial region** and **charge currency**. Self-serve profile fields (`organizations.country_code`, etc.) support UX and operations but **do not** alone determine eligibility for India vs international price books.

**Controls (layer as the product matures):**

1. **At payment:** Collect **billing country** (and legal name) on the payment provider; **only offer INR checkout** when billing country and rules say India-eligible; **only offer USD** (or other intl) otherwise. Reject or escalate if profile country and billing country conflict.
2. **Payment instrument:** Card **BIN / issuer country** and **settlement currency** as a **signal** (not sole proof — expats, corporate cards). Flag mismatches for review or require extra verification.
3. **India-specific:** If claiming India commercial seat, **GSTIN** (when provided) should pass **format** checks; optional **government or vendor GST verification API** for high-value or suspicious signups.
4. **Contract / ToS:** Reserve the right to **correct pricing**, **invoice difference**, **limit features**, or **terminate** for deliberate mis-declaration; require accurate legal entity details.
5. **Operations:** **Manual review** queue for: billing country ≠ org country, frequent country changes, many orgs under INR with no Indian nexus, etc.
6. **Weak signals (audit only):** IP geolocation (VPN caveat), device locale — do not use as primary entitlement.

**Product copy:** Checkout and plan pages should state that **plan price and tax depend on verified billing / commercial region**.

**Implementation (app / DB sketch):** `organizations.commercial_region` (`in` | `intl`), optional `billing_country_code` and `plan_period_*` for post-payment use; `account_entitlements` (one row per billing owner user) holds `plan`, `commercial_region`, `max_companies`, and links from `organizations.entitlement_id`. New signups use `bootstrap_organization` to create org + entitlement. Company save enforces India profile when `commercial_region = in`. Pricing UI uses `commercial_region` for INR vs USD. Plan changes sync `max_companies` on the entitlement via DB trigger when `organizations.plan` updates.

#### 2.1.6 Enterprise / self-hosted

**Not** in the standard three-column plan grid. Highlight separately: **Enterprise** — self-hosted or dedicated deployment, custom limits, security reviews. **Contact sales** to discuss (no self-serve price on the main comparison).

#### 2.1.7 Plan changes & downgrades (draft — implement later)

When a **paid plan period ends** without renewal or upgrade, the subscription is treated as **Free** (entitlement and organization `plan` align with **Free** limits in §2.1). The following rules apply **engineering and UX to be built**; wording is the product intent.

1. **Lapsed paid period → Free + member read-only**  
   Move the **account owner** to the **Free** plan. **Other users** who are **not** among the members the owner is allowed to keep **active** under **Free** (see §2.1: **2** users total across the subscription, **1** company) are **read-only**: they **must not** create any **new** document nor **edit** any existing document (draft or issued). They **may** open, **view**, and **download** (or use print preview for) **prior** documents they are entitled to see under normal visibility rules (§5). The **account owner** remains able to operate fully until remediation below is incomplete—product may still **block** owner from certain actions until excess companies/users/admins are resolved, if needed for consistency.

2. **Extra companies**  
   If the subscription has **more companies** than **Free** allows (**1**), the **account owner** **must choose** which **one** company stays **fully active**. **Other companies** become **read-only** for **everyone** (no new documents, no edits; viewing and downloading existing data allowed per normal access).

3. **Extra users**  
   If there are **more active users** than **Free** allows (**2** total across the subscription), the **account owner** **must choose** which users stay **active** (full permissions subject to Free rules). **All other users** are **read-only** as in (1) until removed or deactivated per future UX.

4. **Extra company admins**  
   **Free** allows **no** company-admin seats (only the **account owner** has admin rights for subscription/company management—§2.1, §5). After downgrade, **all** `company_admin` flags are **removed** (or the owner is forced through a step that clears them). There is **no** separate “pick one admin” on Free—**only the owner** retains admin capabilities.

5. **Monthly quota after downgrade**  
   **Already-issued** documents and passes **remain** issued; usage counters for the **current IST month** are **not** rolled back. If the account **already exceeded** **Free** monthly limits (§2.3) for that month, **block new issues** (quotation / packing list / delivery challan / gate pass / visitor pass per quota rules) until the **next** calendar month in **IST** (§4.1). **Drafts** do not consume quota until issue; policy on **creating new drafts** while over cap is implementation detail—prefer **allow drafts**, **block issue** until next period.

**Remediation UX (sketch):** Guided **Account** or **Team** flow until companies ≤ cap, active users ≤ cap, and no company admins remain on Free; until complete, enforce read-only and blocks as above.

### 2.2 Free tier — branding

- **“Powered by eazmybiz”** on **PDFs**, **emails**, **gate passes**, and analogous customer-facing artifacts.
- **Pro / Max:** No powered-by on those surfaces (optional tiny legal line in admin-only areas — product decision later).

### 2.3 Free tier — usage quotas (per company, per month)

All resets use **Asia/Kolkata** — see §4.

| Metric | Limit | What counts |
|--------|--------|-------------|
| **Documents (combined)** | **30** / month | **Quotation + packing list + delivery challan**, combined |
| **Gate passes** | **60** / month | Issued material gate passes |
| **Visitor passes** | **60** / month | Issued visitor passes (first **issued** per visit counts once; see §8) |

**Pro / Max (per company, per month, same counting rules):**

| Metric | **Pro** | **Max** |
|--------|---------|---------|
| Documents (combined) | **500** | **Unlimited** |
| Gate passes | **500** | **2,000** |
| Visitor passes | **500** | **2,000** |

### 2.4 Trust (Pro and above — marketing vs engineering)

- **Target:** Secured cloud, strong tenant isolation, restricted operational access.
- **Auth bot resistance (engineering):** Sign-in, sign-up, and forgot-password use **Cloudflare Turnstile** when configured (`NEXT_PUBLIC_TURNSTILE_SITE_KEY` + Supabase Auth CAPTCHA with Turnstile). This reduces automated credential abuse; document creation remains gated by authenticated sessions and RLS.
- **Strong “we cannot read your data”** may require **customer-managed keys** or field-level encryption later — phase if a segment requires it.

---

## 3. Geography and compliance

- **Build for multi-country** (locales, currencies, address/tax ID flexibility).
- **Primary market: India** — defaults, copy, and compliance emphasis (e.g. GSTIN on masters, state codes, challan/e-way relevant fields, retention expectations).
- **Company profile** should include **country/region** to drive defaults and PDF fields.

---

## 4. Timezone and quota rules

### 4.0 Document and visit dates (organization calendar)

- **Primary rule — quotation, packing list, delivery challan (document date):** These use an **organization calendar** — the IANA timezone stored on the organization (`calendar_time_zone`) or, when unset, a default derived from the organization **country** (e.g. India → `Asia/Kolkata`). **“Today”**, **backdate limits** (7 / 30 days by role, unchanged), and **blocking future dates** (prepare and issue) are evaluated in that zone so **remote users are not penalized** by their own browser timezone.
- **Material gate pass (pass date):** Uses the same organization calendar for **“today”**, but **does not allow backdates** (pass date must be **today or later**, up to **15** days ahead), like visitor **visit date** — **not** the 7/30-day backdate rule used for quotation / packing list / delivery challan. **Issue** and **recording material movement** are allowed only when organization-calendar **today** is **on or after** that pass date (drafts may still be prepared in advance).
- **Visitor pass (visit date):** Uses the same organization calendar for **“today”**, but **visitor passes do not allow backdates** (visit date must be **today or later**, up to **15** days ahead). **Check-in** only on the visit date; **check-out** within **24 hours** of check-in (see **Visitor pass (MVP)** in §1).
- **Monthly usage quotas** (below) remain **IST-only** and are independent of this calendar.

### 4.1 Monthly period (quotas)

- **Timezone:** **`Asia/Kolkata` (IST)**.
- **Period key:** **`YYYY-MM`** computed in IST (calendar month in IST).
- **Reset:** New monthly quotas apply at **IST midnight on the 1st** of each calendar month.

### 4.2 What increments quotas

- Count **only** when a record is **issued** or **finalized** (one terminal state per document type).
- **Drafts** and edits **before** issue **do not** consume quota.
- **Idempotency:** Increment **once** when the record **first** enters issued/finalized; re-print or re-issue must **not** increment again unless product explicitly adds a new rule.

### 4.3 Suggested implementation notes

- Store usage keyed by `organization_id` + `period_ym` + metric type.
- Show usage in UI (e.g. “12 / 30 documents this month”).

---

## 5. Users, admins, and permissions

- **Account owner (master admin):** The user who owns the `account_entitlements` row for the subscription. They can **create additional companies** (within plan company limits), **switch the active company** in the app, see **Account** (all companies on the subscription), and manage **Team & access** on any company they belong to. They have **full module access** everywhere.
- **Company admin:** A user flagged as **company admin** on at least one company. They can **manage team members and feature permissions** for companies where they have that flag. They **do not** create new top-level companies. They only see **their own company’s** data (not a cross-company account overview unless they are also the account owner).
- **Company profile & logo:** Only the **account owner** and **company admins** can open **Company** settings. **Only the account owner** can change the **legal company name**, upload or remove the **org logo**. **Company admins**: **GSTIN / tax ID**, **bank details**, and **communication address** (including region) require **account owner approval** before they apply on documents; **country code**, email, mobile, default currency, and document terms save immediately. The account owner’s own edits apply immediately. **Notifications:** **Bell** (top bar) and **sidebar → Notifications** (below Team &amp; access) for admins and the account owner; **Dashboard** shows **Recent notifications** at the **bottom** with **View all** → Notifications. The feed includes company profile activity (per-field approval and saves), approve/reject lines, logo changes, and **Team &amp; access** (invites, member updates, invitee finished password). Pending approval cards list **only changed fields**; **multiple** admin submissions **queue per company** (oldest first) until the owner approves or rejects each. The **Notifications** page can show **line-by-line** before/after under an event; the **bell** stays a short summary. **Account** focuses on plan, pending approvals, and adding companies; the full activity list is under **Notifications**.
- **Pricing (in-app):** Sidebar **Pricing** and `/settings/pricing` are shown only to the **account owner** for the active company’s subscription and **company admins** on that company. Invited members **without** the company-admin flag do not see pricing (direct navigation redirects home). The page shows **current plan**, subscription **validity** when `account_entitlements` period fields are set, and **placeholder** upgrade / extend controls until payment checkout is wired.
- **Member presets:** **Office** and **Gate** presets still exist; each member gets **per-module toggles** (quotation, packing list, delivery challan, gate pass, visitor, parties, saved items, company profile settings) plus **Visitor desk (check-in / check-out)** and **Record material in / out at gate**. **RLS** enforces module flags on tenant data. **Check-in/out** and **recording material movement** on an issued gate pass are restricted when the company assigns at least one **non-admin** member (other than the account owner) to that desk or gate role; until then, anyone with the visitor or gate-pass module may perform those actions (covers small teams and Free where one person does everything). The **account owner** and **company admins** may always check visitors in/out and record gate movement.
- **Document privacy (per creator):** **Company admins** and the **account owner** can open every quotation, packing list, delivery challan, gate pass, and visitor record in the company. **Other members** (e.g. office or gate without the company-admin flag) can open **only their own** such records (tracked by `created_by_user_id`). **Exception — operational handoff:** members allowed to **check visitors in/out** may read and update visitor visits they did not create when the product’s checkpoint rules say so; members allowed to **record material movement** may read and update issued gate passes they did not create for that purpose. **Legacy rows** with no stored creator remain visible to any member who has the relevant module access. **Parties** and **saved items** remain company-scoped for members with access (not hidden per creator).
- **Party and saved-item maintainers:** The user who **creates** a party or saved catalog item is its **maintainer**. **Party** address and name rules are in §1 **Parties (masters)**. **Saved items:** **Company admins** and the **account owner** may change the item **name** and **unit**. **Any member** with **Items** access may update **HSN/SAC**, **make / service provider**, and **model / part no**; when the editor is **not** a company admin or the account owner, those field changes are **logged** on the item detail page under **Activity** (below **Remove item**). **Deleting** a saved item requires the **item maintainer**, a **company admin**, or the **account owner** (and the item must not be in use on documents). **Legacy** rows with no maintainer: only admins and the account owner may change **name**/**unit** or delete; any member with Items access may still update HSN/make/model as above. If an auth user is removed in a way that clears the maintainer reference, the same **admins / owner** rule applies for delete and for **name**/**unit**.
- **Party / item maintainers when someone leaves:** When a member is **deactivated** (Pro / Max), **parties** and **saved items** they maintained **stay in the database**; **maintainership** is **reassigned** to an **active company admin** (earliest admin membership first), or to the **account owner** if there is no active company admin on that company.
- **Company-admin seats (excluding the account owner):** **Free — 0**, **Pro — 2**, **Max — 5**, counted **across all companies** on the subscription (the same person as admin on two companies still counts **once**). **Pro:** **at most one** active company admin **per company**; the same person may be that admin on **each** Pro company. **Max:** **multiple** company admins **per company** are allowed (e.g. future department or vertical leads), still subject to the **account-wide** seat count. The account owner does not consume a company-admin seat.
- **User limits** stay as in §2.1 (e.g. Free **2** users, Pro **10**, Max **50**) across the entitlement.
- **Adding users:** Admins send an **email invite**; the invitee opens the link, **chooses a password**, then enters the
  app with the assigned role and module access. If the email **already has an account**, they are added to the company
  without a duplicate invite.
- **Deactivating members (Pro / Max):** Account owner or company admin may set a member **inactive** when they leave the company. Inactive users **do not count** toward the plan user limit and **cannot sign in** to that company. **Quotations, packing lists, delivery challans, gate passes, and visitor records** they created remain in the system but are **visible only to the account owner and company admins** (not to other active members). **Parties and saved items** they maintained also remain; see **Party / item maintainers when someone leaves** above. **Free** plans do not offer deactivation in-app (members stay active). **Legacy rows** without a stored creator remain visible to all members with module access.
- **Deleting a recent invite (no footprint):** From **Team & access**, an admin may **permanently delete** another user’s **auth account** only when that user belongs to **this company alone**, was added within the **last 30 days**, has **not created** any quotation / packing list / delivery challan / gate pass / visitor record (by `created_by`), and is **not** the account owner. Deletion removes their login and membership (cascade); use for mistaken invites or users who never used the app.

---

## 6. Technical direction (MVP)

Aligned with performance-conscious defaults; free tiers on vendors are acceptable for MVP with sound architecture.

| Layer | Direction |
|--------|-----------|
| App | **Next.js** (App Router), **TypeScript** |
| Hosting | **Vercel** (or equivalent) |
| Data / auth / files | **Supabase** (Postgres, Auth, RLS, Storage for logos/PDFs) |
| PWA | Installable web app; same codebase as desktop web |
| Email | Transactional provider (e.g. Resend, Postmark, SendGrid) |
| PDFs | Server-side generation for consistent output |

**Performance habits:** Indexed queries, pagination, connection pooling for serverless, `next/image`, avoid hot-path bloat.

---

## 7. Out of scope for first MVP (examples)

- Native App Store / Play Store apps (PWA first).
- Advanced self-hosted **Advanced** tier (plan architecture early; ship when revenue supports).
- Full BYOK / zero-knowledge unless a customer segment requires it.

---

## 8. Open decisions (fill as you lock them)

- [x] Exact **Pro** and **Max** numeric limits for documents / gate / visitor (see §2.1.1).
- [x] **Visitor** metric: **issued pass** (draft → issued) counts once per visit record; check-in/out does not consume quota.
- [x] **Document print/PDF themes (quotation, packing list, delivery challan):** **Free** — **Basic** only. **Pro** — **Basic**, **Standard Pro** (emerald), and three Pro themes (navy, burgundy, slate). **Max** — those five plus three Max themes (Pacific teal, brushed gold, carbon). Same plan-gated choices on all three document types. Applies to **print preview and PDF** only; consigner branding and addresses unchanged.
- [ ] Whether **re-issue** after void ever consumes a new slot (default: no).

---

*Last aligned with planning thread: product scope, tiers, IST quotas, issued-only counting, India-first multi-country, two-user Free model, stack direction.*
