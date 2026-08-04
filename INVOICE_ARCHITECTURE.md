# ToolFlight Invoice & Business Manager — Architecture (Phase 1)

This document is the design foundation for Phases 2+. Nothing described
below as "future" is implemented yet — Phase 1 ships Guest mode only.

## Current status (Phase 1, shipped)

- `invoice-maker.html` — standalone page, not routed through `build.py`'s
  shared tool-template system (see "Why standalone" below).
- `js/invoice.js` — isolated JS module. Owns nothing outside this page:
  no shared globals, no DOM ids used by any other tool.
- `css/invoice.css` — isolated stylesheet, reuses existing design tokens
  (`--card`, `--card-border`, `--accent1`, `--ink`, `--ink-soft`) for visual
  consistency but defines no class name that collides with any other tool.
- Guest-mode invoice creation: business info, customer info, line items,
  currency, tax, discount, notes, live preview, print, and PDF download
  (via pdf-lib, drawing real text — not a screenshot).
- No account system, no Firebase calls, no localStorage persistence of
  business data. Closing the tab discards everything, and the page says
  so honestly.

## Why standalone, not the shared `build_image_tool_page()` template

Every other ToolFlight tool (calculators, PDF tools, image tools) is
generated from a Python dict (`{"slug", "name", "intro", "features", ...}`)
fed into one shared template function. That pattern fits a single-purpose,
stateless tool well.

Invoice Maker doesn't fit that shape: it has multiple UI modes (guest vs.
account), a multi-step form with client-side state, and will eventually
need authentication-aware rendering. Forcing it into the shared template
would mean adding invoice-specific branches inside a function every other
image tool also depends on — the exact opposite of the isolation this
phase was asked to guarantee. A standalone HTML file (the same pattern
`contact.html` already uses) keeps 100% of the invoice logic out of any
code path shared with an existing tool.

## Two-mode architecture (Guest vs. Account)

Both modes are designed to share the same core building blocks:

```
calculateTotals(state)   // pure function, no DOM, no storage
renderPreview(state)     // pure render, reads state, writes DOM
```

The `state` object shape (`business`, `customer`, `meta`, `items[]`, `tax`,
`discount`, `notes`) is written now to already match what a Firestore
`invoices/{id}` document will eventually look like. When Phase 2 adds
Account mode, the same two functions should work unchanged — only the
code that decides *where the state comes from* (a local JS variable today,
a Firestore snapshot listener later) and *where it's saved to* needs to be
new. This is the concrete mechanism for "the same invoice interface works
in both modes without duplicating the app."

## Firebase architecture (prepared, not active)

No Firebase SDK is loaded on `invoice-maker.html` in Phase 1. There is no
Firebase project connected to this repository (confirmed by auditing the
repo before starting — no `firebase.json`, no SDK config, no API keys
anywhere). Phase 2 should:

1. Create a real Firebase project (Authentication + Cloud Firestore).
2. Add the Firebase Web SDK via the same CDN-script-tag pattern already
   used for pdf-lib/jszip/qrcode-generator elsewhere on the site (no
   bundler exists in this repo, so this stays consistent with everything
   else).
3. Load Firebase config from a single, clearly-isolated file — this
   phase includes `js/firebase-config.example.js` as the template for
   that file. **The real config file must never be committed with live
   values in a way that's inconsistent with the security rules below** —
   Firebase Web SDK config values are not secret by themselves (they're
   visible in any browser's dev tools regardless), but the Firestore
   Security Rules are what actually protects data, not the config file.

### Firestore Security Rules (prepared, not active)

`firestore.rules` in this delivery is a real, secure-by-default draft
matching the multi-tenant model below. It explicitly does **not** use
`allow read, write: if true` anywhere. Core logic:

- A user can only read/write a `businesses/{id}` document if their UID
  appears in that business's `businessMembers` subcollection.
- Within a business, what a member can do is gated by their
  `permissions` map (see Permissions model below) — a member without
  `invoices.edit: true` cannot write to that business's invoices, even
  though they can read them if `invoices.view: true`.
- No collection is globally readable or writable. Every rule requires
  resolving the requester's membership and permission first.

This file is a draft for Phase 2 to test against Firebase's Rules
Simulator before going live — it has not been deployed anywhere, since
no Firebase project exists yet.

## Data model (design only — no collections created yet)

```
users/{uid}
  displayName, email, createdAt
  // A user's own profile. Which businesses they belong to is NOT stored
  // here (avoids needing to keep two places in sync) -- it's derived by
  // querying businessMembers where uid == this user.

businesses/{businessId}
  name, ownerUid, createdAt, defaultCurrency, taxSettings: { enabled, defaultRate }

businesses/{businessId}/businessMembers/{uid}
  role: "owner" | "member"
  permissions: {
    invoices:  { view, create, edit, delete }
    customers: { view, create, edit, delete }
    products:  { view, create, edit, delete }
    inventory: { view, adjust }
    reports:   { view }
    settings:  { view, edit }
    team:      { manage }
  }
  invitedAt, joinedAt

businesses/{businessId}/customers/{customerId}
  name, email, address, phone, notes, createdAt

businesses/{businessId}/products/{productId}
  name, description, unitPrice, sku, taxable, createdAt

businesses/{businessId}/inventory/{productId}
  quantityOnHand, reorderThreshold, lastAdjustedAt, lastAdjustedByUid

businesses/{businessId}/invoices/{invoiceId}
  number, status: "draft"|"sent"|"paid"|"overdue"|"void"
  customerId, currency, issueDate, dueDate
  subtotal, discountAmount, taxAmount, total
  notes, createdByUid, createdAt, updatedAt

businesses/{businessId}/invoices/{invoiceId}/invoiceItems/{itemId}
  description, qty, unitPrice, productId (optional link to products/{id})

businesses/{businessId}/payments/{paymentId}
  invoiceId, amount, method, paidAt, recordedByUid

businesses/{businessId}/sales/{saleId}
  // Aggregated/derived records for reporting -- exact shape to be
  // finalized in the Reports phase, intentionally not locked in now.

businesses/{businessId}/settings/{document}
  // Per-business configuration: invoice numbering scheme, default
  // payment terms, branding, etc. -- fields to be added as needed.

businesses/{businessId}/backups/{backupId}
  createdAt, createdByUid, storageRef
```

**Multi-tenancy**: every business-owned collection is a subcollection of
`businesses/{businessId}`, never a top-level collection with a
`businessId` field. This makes "can this user see this document" a
single membership check at the top of every rule, rather than needing to
verify a foreign-key-style field on every single document type.

**One user → many businesses**: supported today by the model, since
`businessMembers` is queried by `uid`, not stored inside the user's own
document — a user can appear as a member of any number of `businesses/*`
documents with no schema change needed.

**One business → many team members, each with their own permissions**:
each `businessMembers/{uid}` entry has its own independent `permissions`
map, so two members of the same business can have completely different
access without any special-casing in the data model.

## Permissions model (design only)

Matches the categories from the Phase 1 spec exactly (invoices, customers,
products, inventory, reports, business settings, team) as boolean flags
inside each member's own `permissions` map, as shown above. `role: "owner"`
is a separate field — an owner is expected to implicitly have every
permission true, checked as `role == "owner" || permissions.x.y == true`
in the security rules, so a newly-created business's owner doesn't need
every permission flag manually set to true at creation time.

## Guest → Account bridge (design only, not built)

Planned flow for a later phase: after a guest downloads their invoice,
show a dismissible, non-blocking prompt — "Want to save your business and
invoice for next time? [Create Free Account]" — never forced, never
blocking the download/print actions themselves. If accepted, the same
`invoiceState` object already in memory becomes the first write to a new
`businesses/{id}/invoices/{id}` document, so nothing the guest already
typed needs to be re-entered.

## What Phase 2 should NOT need to change

- `calculateTotals()` and `renderPreview()` in `js/invoice.js` — designed
  to be storage-agnostic already.
- `css/invoice.css` — isolated from every other tool's styles.
- Any existing ToolFlight tool — zero changes were made to `js/app.js`
  or `css/style.css` to ship Phase 1.

## Phase 6: Team Members & Role-Based Permissions

**New files**: `js/invoice-team.js`. **Modified**: `invoice-maker.html` (Team tab + invite modal), `js/invoice-business.js` (owner's member doc now includes email; tab-switching updated), `firestore.rules` (self-elevation and owner-protection fixes on `businessMembers`, plus the new `invites` collection).

### Why invites are a separate collection, not a direct `businessMembers` write
The Firebase Web SDK cannot look up a user's UID from their email address client-side -- that requires the Admin SDK / a backend, which is explicitly out of scope. So `businesses/{id}/invites/{autoId}` stores pending invites keyed by email with `status: "pending"`. When the invited person actually signs in, `invoice-team.js` checks (via a `collectionGroup` query) for any pending invite matching their authenticated email, and only then -- the first moment a real UID exists for that email -- converts it into a real `businessMembers/{uid}` document and marks the invite `"accepted"`.

### Role presets (client-side convenience only)
"Manager"/"Staff"/"Viewer" are starting points that populate the same `permissions.{resource}.{action}` fields the security rules already check -- not a new schema concept. The UI's "Manage Customers"/"Manage Products" checkboxes are a simpler label over `create+edit+delete` together; the underlying fields are unchanged from Phase 3.

### Security fixes made during this phase's audit
Two real gaps found in the Phase 1-5 `businessMembers` rule: (1) self-elevation -- any member with `team.manage` could previously write to their own member document, including granting themselves `owner` or more permissions; (2) no protection against the owner's own document being downgraded or deleted. Both are now explicitly blocked in `firestore.rules`, independent of what the UI does or doesn't show.

## Phase 9: Deployment Preparation (Firebase connection itself not possible)

**Honest status**: No real Firebase project has ever been connected to this repository. Phase 9 asked to connect to and test against a real project -- that requires either the user's actual Firebase credentials (never provided) or this environment creating a project itself (no network access to do so). Sections 2-8 of the Phase 9 spec (real auth testing, real Firestore transactions, real Rules Simulator testing) could not be performed for this reason, not simulated as a substitute.

**What was genuinely new and possible without a live project**:
- `firestore.indexes.json` -- a real, previously-missing deployment requirement discovered by auditing the code's actual queries: `acceptPendingInvitesForUser()` runs a `collectionGroup` query on `invites` filtered by both `email` and `status`. Firestore requires an explicit composite index for any multi-field-filtered `collectionGroup` query. Without deploying this index, invite acceptance would fail with a runtime error the first time any user signed in -- caught by the existing try/catch (so it wouldn't crash the page), but the feature would silently never work.
- `netlify.toml` -- didn't exist; the site already uses Netlify Forms (`data-netlify` on `contact.html`/`index.html`) confirming Netlify as the real target. Publishes the static output directly (no build command needed at deploy time, since `build.py` runs locally beforehand) and adds baseline security headers.

**Firebase Console steps still required before any of Phases 2-8's Firebase-dependent work is real**:
1. Create the Firebase project, enable Email/Password Authentication, enable Firestore.
2. Replace every `REPLACE_WITH_REAL_*` placeholder in `js/firebase-config.js`.
3. Deploy `firestore.rules` -- verify in the real Rules Simulator first.
4. Deploy `firestore.indexes.json` (or let Firebase auto-prompt via the direct index-creation link it shows when a query fails from a missing index).
5. Only then can Phases 2-8's account/business/team/inventory functionality be tested for real.
