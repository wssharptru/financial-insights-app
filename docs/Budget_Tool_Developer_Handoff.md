# Budget Tool --- Developer Handoff Document

**Purpose:** This document translates the finalized blueprint for the
Budget Tool into a concrete, developer-friendly handoff. It contains
file changes, schema definitions, validation logic, sync behavior, UX
details, migration instructions, testing checklist, and a focused
micro-demo prototype plan.

------------------------------------------------------------------------

# 1. Summary & Scope

**Scope:** Implement the Budget Tool inside the existing single-page
application. Feature set includes: - Persistent budget worksheet stored
in Firestore. - Hybrid editing (modals for add/edit of structured data;
inline editing for Amount and Payee fields). - Structured
category/sub-category model, with migration from legacy hyphenated
strings. - Smart sync: debounce, batch writes, Firestore offline
persistence, per-row and global sync status indicators. - Conflict
detection using `lastUpdated` + `deviceId` with user-driven resolution.

**Out of scope for Phase 1:** Full multi-budget management UI (beyond
default Personal Budget), advanced analytics (Budget vs. Actuals ---
Phase 2), mobile-specific optimizations.

------------------------------------------------------------------------

# 2. File Map (create / modify)

**New files** - `pages/budget.html` --- main view for the budget
worksheet. - `assets/css/budget.css` --- tool-specific styles. -
`assets/js/budget.js` --- primary logic, rendering, validation glue, and
sync helpers.

**Modified files** - `partials/modals.html` --- add `#incomeModal` and
`#expenseModal` markup. - `partials/sidebar.html` --- add navigation
link with `data-section="budget"`. - `assets/js/event-listeners.js` ---
call `initializeBudgetTool()` during app init. - `assets/js/renderer.js`
--- add case `'budget'` in `renderAll()` calling `renderBudgetTool()`. -
`assets/js/firestore.js` --- extend user document structure (add
`budgets` array) and update `loadInitialData()` to run migration. -
`sw.js` --- add budget assets to the cache list (increment version).

------------------------------------------------------------------------

# 3. Data Model & Firestore Schema

**User document (top-level)**

``` json
{
  "uid": "user_123",
  "displayName": "...",
  "budgets": [
    {
      "id": "budget_1",
      "name": "Personal Budget",
      "currency": "USD",
      "createdAt": "2025-09-09T12:00:00Z",
      "lastUpdated": "2025-09-09T12:10:00Z",
      "items": [ /* expenses and incomes mixed or separated by type */ ]
    }
  ]
}
```

**Expense document (example item inside `items`)**

``` js
{
  id: "uuid-v4",
  type: "expense", // or "income"
  amount: 120.50,
  currency: "USD",
  date: "2025-09-09", // ISO date string
  payee: "Trader Joe's",
  category: {
    main: "Food",
    sub: "Groceries"
  },
  notes: "Weekly run",
  createdAt: "2025-09-09T12:00:00Z",
  lastUpdated: "2025-09-09T12:01:30Z",
  deviceId: "device-abc123"
}
```

**Rationale** - `id` ensures stable references for inline editing,
batching, and conflict resolution. - `lastUpdated` + `deviceId` allow
detection of out-of-order or conflicting updates. - `type` allows mixed
arrays or easier filtering by type; you may also separate `incomes` and
`expenses` arrays if preferred.

------------------------------------------------------------------------

# 4. Migration Plan (Legacy category strings)

**Trigger**: Run on first `loadInitialData()` after the budget tool is
added for an existing user.

**Algorithm (JS pseudocode)**

``` js
async function migrateLegacyCategories(userDocRef) {
  const userDoc = await userDocRef.get();
  const data = userDoc.data();
  let changed = false;

  if (!data.budgets) return;

  data.budgets.forEach(budget => {
    budget.items = budget.items.map(item => {
      if (item.category && typeof item.category === 'string' && item.category.includes('-')) {
        const [main, sub] = item.category.split('-').map(s => s.trim());
        item.category = { main: main || 'Uncategorized', sub: sub || '' };
        changed = true;
      }
      return item;
    });
  });

  if (changed) {
    // Use a batched write to persist the migration safely
    await userDocRef.ref.set(data, { merge: true });
  }
}
```

**Notes** - Always backup a copy of the user document before running
destructive migrations (e.g., export to a backup collection
`migrations_backup/{uid}`). - Migration should be idempotent: repeated
runs cause no additional changes.

------------------------------------------------------------------------

# 5. Validation Module

... (rest of the document)
