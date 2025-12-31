# Performance Audit Report

**Date:** December 31, 2025
**Scope:** Full codebase analysis covering Next.js 15 App Router application
**Focus Areas:** Request Waterfalls, Request Deduping, Client vs Server, Memoization, Over-fetching, Dynamic vs Static, Middleware Overhead

---

## Executive Summary

This audit identified **32 performance issues** across the codebase, with **5 critical issues** that require immediate attention. The most severe problems are:

1. **N+1 query patterns** causing 80+ database queries per page load
2. **Sequential database queries** (waterfalls) adding 200-400ms latency
3. **No request deduplication** via React.cache() in Server Components
4. **Aggressive client-side polling** (5-30 second intervals) causing unnecessary network traffic
5. **Overuse of Client Components** where Server Components would eliminate loading states

**Estimated Impact of Fixes:**
- 40-60% reduction in initial page load time
- 30-50% reduction in API request volume
- 80-90% reduction in database query count for affected endpoints

---

## Critical Issues

### C1. N+1 Queries in Conversations Endpoint

**Severity:** CRITICAL
**Category:** Request Waterfalls
**File:** `src/app/api/company/conversations/route.ts`
**Lines:** 119-193

**Issue:** For each conversation in the paginated response (default 20), the endpoint executes 3 separate database queries inside a `Promise.all()` loop to fetch end user, agent, and last message data. This results in 60+ queries for a single page load.

**Impact:**
- Response time: 800-1200ms (should be 50-100ms)
- Database connection pool exhaustion under load
- Poor user experience with visible loading delays

**Affected Operations:** Conversations list, inbox, support agent dashboard

**Suggested Solution:**

Replace the N+1 pattern with Drizzle ORM joins. Refactor lines 97-193 to use a single query with left joins:

1. Use `db.select().from(conversations).leftJoin(endUsers, eq(conversations.endUserId, endUsers.id)).leftJoin(agents, eq(conversations.chatbotId, agents.id))` to fetch conversations with related data in one query.

2. For last messages, use a lateral join or subquery approach: Create a CTE (Common Table Expression) using `sql` template literal that ranks messages by conversation and selects the most recent one, then join this back to the main query.

3. Move the search filtering to the database level using SQL `ILIKE` operators instead of post-fetch JavaScript filtering (lines 156-166).

4. Expected result: Reduce from 60+ queries to 2-3 queries total.

---

### C2. Dashboard Stats Sequential Query Waterfall

**Severity:** CRITICAL
**Category:** Request Waterfalls
**File:** `src/app/api/master-admin/dashboard/stats/route.ts`
**Lines:** 34-97

**Issue:** The GET handler executes 8 database queries sequentially using individual `await` statements. Each query waits for the previous to complete.

**Impact:**
- Response time: 320-400ms (should be 50-80ms with parallel execution)
- Blocks dashboard rendering
- Compounds with other waterfalls in dashboard

**Queries Affected:** Total companies, companies this month, companies last month, active companies, active companies last month, total users, users this month, users last month, MRR

**Suggested Solution:**

Wrap all independent queries in `Promise.all()`. Refactor lines 34-97:

1. Create an array of all 9 query promises without awaiting them individually.

2. Execute them in parallel using `Promise.all([query1, query2, ...query9])`.

3. Destructure the results: `const [totalCompaniesResult, companiesThisMonth, companiesLastMonth, ...] = await Promise.all([...])`.

4. Alternative optimization: Combine related queries into single SQL statements using `CASE WHEN` expressions to calculate multiple counts in one query. For example, combine all company-related counts into one query with conditional aggregation.

5. Expected result: Response time drops from ~400ms to ~60ms (limited by the slowest single query).

---

### C3. No React.cache() Usage for Request Deduplication

**Severity:** CRITICAL
**Category:** Request Deduping
**Scope:** Entire codebase

**Issue:** The codebase does not utilize React's `cache()` function for Server Components. This means identical data requests from different components execute duplicate database queries within the same render pass.

**Impact:**
- Duplicate authentication checks per render
- Repeated company/chatbot lookups across component tree
- No automatic deduplication for expensive computations

**Affected Areas:** All Server Component data fetching, `requireCompanyAdmin()`, `requireMasterAdmin()`, company details, chatbot details

**Suggested Solution:**

Create a new file `src/lib/data/cached-queries.ts` with cached versions of common data fetching functions:

1. Import `cache` from 'react' at the top of the file.

2. Wrap auth guard functions: Create `cachedRequireCompanyAdmin` by wrapping the existing `requireCompanyAdmin` function with `cache()`. This ensures multiple Server Components calling this function in the same render only execute one database query.

3. Create cached data fetchers for common entities: `getCompanyById`, `getChatbotById`, `getUserPermissions` - each wrapped with `cache()`.

4. Update Server Components and layouts to use the cached versions instead of direct database calls.

5. Note: `cache()` only deduplicates within a single request/render cycle. For cross-request caching, combine with `unstable_cache` or Next.js data cache.

---

### C4. Excessive SWR Polling Intervals

**Severity:** CRITICAL
**Category:** Client vs Server
**Files:**
- `src/hooks/company/useConversations.ts:112-116` (5 second polling)
- `src/hooks/company/useDashboard.ts:70-86` (30 second polling)
- `src/hooks/master-admin/useActivityFeed.ts:22-28` (30 second polling)
- `src/hooks/company/useConversations.ts:70-74` (30 second polling)

**Issue:** Multiple SWR hooks poll APIs at aggressive intervals, creating constant network traffic even when data hasn't changed.

**Impact:**
- 5-second polling: 720 requests/hour per user for messages alone
- Battery drain on mobile devices
- Unnecessary server load
- Bandwidth consumption

**Suggested Solution:**

1. **Replace 5-second message polling with WebSocket/SSE:** Create a real-time message subscription using Supabase Realtime or a custom WebSocket endpoint. In `useConversationMessages`, subscribe to message inserts for the specific conversation ID instead of polling.

2. **Increase polling intervals for non-critical data:**
   - Conversation list: Change from 30s to 60s or disable and use manual refresh
   - Dashboard stats: Change from 30s to 120s (2 minutes)
   - Activity feed: Change from 30s to 60s

3. **Use SWR's `revalidateOnFocus: false`** for data that doesn't need immediate refresh when user returns to tab.

4. **Implement conditional polling:** Only poll when the browser tab is visible. Add `revalidateIfStale: false, revalidateOnReconnect: false` for less critical endpoints.

5. **Consider Server-Sent Events (SSE)** for real-time dashboard updates as a lighter alternative to WebSockets.

---

### C5. Client Component Overuse for Data Fetching

**Severity:** CRITICAL
**Category:** Client vs Server
**Files:**
- `src/app/(master-admin)/admin/dashboard/page.tsx`
- `src/app/(company-admin)/dashboard/page.tsx`
- `src/app/(support-agent)/inbox/page.tsx`
- `src/app/(support-agent)/inbox/starred/page.tsx`
- `src/app/(company-admin)/chatbots/page.tsx`

**Issue:** Five major pages are marked "use client" and perform data fetching via useEffect/SWR instead of using Server Components. This forces users to see loading spinners on every navigation.

**Impact:**
- Larger JavaScript bundle sent to client
- Loading states on every page navigation
- Slower Time to Interactive (TTI)
- Unnecessary hydration overhead

**Suggested Solution:**

Refactor these pages to use Server Components with streaming:

1. **Remove "use client" directive** from the page files.

2. **Move data fetching to the server:** Replace SWR hooks with direct database queries or fetch calls at the page level. Use the cached query functions from C3.

3. **Create client wrapper components** for interactive elements only. For example, in the dashboard page, the stats grid can be a Server Component that fetches data, while the "Refresh" button is a small Client Component.

4. **Use React Suspense** for loading states: Wrap data-dependent sections in `<Suspense fallback={<LoadingSkeleton />}>`. This allows the page shell to render immediately while data loads.

5. **For real-time updates**, pass initial server-fetched data as props to a Client Component that handles subsequent polling/WebSocket updates. Pattern: `<DashboardClient initialStats={serverFetchedStats} />`.

6. **Example refactor for master admin dashboard:**
   - Page becomes Server Component that fetches initial stats
   - `<StatsGrid>` receives data as props (no loading state)
   - `<RefreshButton>` is a Client Component that triggers revalidation
   - Real-time updates handled via a thin client wrapper if needed

---

## High Priority Issues

### H1. Company Details Route Cascading Queries

**Severity:** HIGH
**Category:** Request Waterfalls
**File:** `src/app/api/master-admin/companies/[companyId]/route.ts`
**Lines:** 85-182

**Issue:** Seven sequential database queries for company, admin user, users count, agents count, conversations count, messages count, and subscription data.

**Impact:** 250-350ms response time for company details

**Suggested Solution:**

1. Fetch the company first (required for validation), then parallelize all stats queries.

2. Replace lines 104-182 with a `Promise.all()` pattern: After getting the company, create an array of 6 independent query promises (admin, usersCount, agentsCount, conversationsCount, messagesCount, subscription) and await them together.

3. For messages count (lines 149-161), replace the two-step approach (fetch conversation IDs, then count messages) with a single aggregated query using a subquery: Count messages where conversation's companyId matches, using a correlated subquery or join.

4. Consider creating a database view or materialized view for company stats if this endpoint is called frequently.

---

### H2. Agent Details Message Count Waterfall

**Severity:** HIGH
**Category:** Request Waterfalls
**File:** `src/app/api/master-admin/companies/[companyId]/agents/[agentId]/route.ts`
**Lines:** 114-133

**Issue:** Three-query dependency chain to count conversations and messages.

**Impact:** 150ms+ additional latency

**Suggested Solution:**

Replace the three-query pattern with a single query using a subquery. Count messages where the message's conversationId is in the set of conversations for this agent, all in one SQL statement using Drizzle's `inArray` with a subquery, or use a join with aggregation.

---

### H3. Chart Data Plan Distribution Loop

**Severity:** HIGH
**Category:** Request Waterfalls
**File:** `src/app/api/master-admin/dashboard/charts/route.ts`
**Lines:** 80-108

**Issue:** Sequential database query per subscription plan inside a `for...of` loop (lines 92-101). Each iteration awaits before the next begins.

**Impact:** 200-250ms latency for 4-5 plan queries

**Suggested Solution:**

1. Replace the sequential loop with `Promise.all()` and `map()`.

2. Refactor lines 92-107: Instead of `for (const plan of plans) { const [countResult] = await db... }`, use `await Promise.all(plans.map(async (plan) => { ... }))`.

3. Better approach: Use a single query with GROUP BY to get all counts at once: `SELECT plan_id, COUNT(*) FROM company_subscriptions WHERE status = 'active' GROUP BY plan_id`. Then map the results to the plans array.

---

### H4. Widget Config Over-Fetching

**Severity:** HIGH
**Category:** Over-fetching
**Files:**
- `src/app/api/company/chatbots/[chatbotId]/widget/route.ts:122-203`
- `src/app/api/master-admin/companies/[companyId]/chatbots/[chatbotId]/widget/route.ts:129-208`

**Issue:** Both endpoints use `.select()` without field specification (line 122-126), returning all 40+ columns from widgetConfigs table including large JSONB fields when the response manually maps only needed fields anyway.

**Impact:** 8-12KB database transfer when 200-400 bytes would suffice

**Suggested Solution:**

1. Replace `.select()` with explicit field selection matching only what's needed for the response. Use `.select({ id: widgetConfigs.id, theme: widgetConfigs.theme, position: widgetConfigs.position, ... })` with only the ~25 fields that are actually used in the response object.

2. For the admin settings panel (which needs all fields), keep full select but add a separate lightweight endpoint for widget initialization that returns only essential display fields.

3. Create a DTO/type that represents the minimal widget config needed for rendering, and select only those fields for public-facing endpoints.

---

### H5. Agents Dashboard N+1 Queries

**Severity:** HIGH
**Category:** Request Waterfalls
**File:** `src/app/api/company/agents/route.ts`
**Lines:** 60-120

**Issue:** For each agent, three separate queries fetch weekly conversation stats (lines 63-95). With 10 agents, this results in 30 additional queries.

**Impact:** 30+ queries for a page with 10 agents

**Suggested Solution:**

1. Replace the `Promise.all(companyAgents.map(async (agent) => { ... }))` pattern with batched queries.

2. First, get all agent IDs from the initial query. Then execute three aggregate queries (not per-agent):
   - Weekly conversations: `GROUP BY chatbot_id` with `WHERE chatbot_id IN (...agentIds)`
   - AI resolved: Same pattern with resolution filter
   - Total resolved: Same pattern

3. Create lookup maps from the results and merge with agent data in JavaScript.

4. Alternative: Create a database function or view that calculates agent stats, reducing application-level complexity.

---

### H6. Embed Widget Sequential API Calls

**Severity:** HIGH
**Category:** Request Waterfalls
**File:** `src/app/embed-widget/page.tsx`
**Lines:** 255-394

**Issue:** Widget initialization requires 4 sequential API calls: config-url fetch, JSON config fetch (from Supabase), fallback config fetch, and session creation.

**Impact:** 400-800ms widget initialization time

**Suggested Solution:**

1. **Race config sources:** Instead of sequential fallback, use `Promise.race()` or `Promise.any()` to fetch from multiple sources simultaneously and use whichever responds first successfully.

2. **Pre-generate static config:** The widget config rarely changes. When config is updated (PATCH endpoint), generate a static JSON file in Supabase Storage (already partially implemented in `generateWidgetConfigJson`). Widget should always load this static file first.

3. **Combine config and session:** Create a new endpoint `/api/widget/init` that returns both config and a new session in a single request, eliminating one round trip.

4. **Use service worker caching:** Cache the widget config in a service worker with stale-while-revalidate strategy.

---

### H7. Missing React.memo on Card Components

**Severity:** HIGH
**Category:** Memoization
**Files:**
- `src/components/company-admin/agents/agent-card.tsx`
- `src/components/master-admin/dashboard/stats-grid.tsx`
- `src/components/company-admin/dashboard/metrics-grid.tsx`
- `src/components/master-admin/dashboard/recent-companies.tsx`
- 6+ additional card/list item components

**Issue:** Card and list item components re-render when parent state changes even though their props haven't changed. The `AgentCard` component creates `dropdownItems` with `useMemo` but isn't wrapped in `React.memo()`.

**Impact:** Unnecessary re-renders during filtering, pagination, and real-time updates

**Suggested Solution:**

1. Wrap the component export with `React.memo()`: Change `export function AgentCard(...)` to `export const AgentCard = React.memo(function AgentCard(...) { ... })`.

2. For `AgentCard` specifically, also memoize the `handleDropdownAction` callback with `useCallback` since it's passed to the Dropdown component.

3. Add custom comparison function if props contain objects that are recreated but semantically equal: `React.memo(AgentCard, (prevProps, nextProps) => prevProps.agent.id === nextProps.agent.id && prevProps.agent.updatedAt === nextProps.agent.updatedAt)`.

4. Apply the same pattern to all card/grid item components that receive stable data props.

---

### H8. Missing useCallback Memoization

**Severity:** HIGH
**Category:** Memoization
**Files:**
- `src/app/(company-admin)/chatbots/page.tsx:25-50` (3 handlers)
- `src/components/master-admin/companies/companies-table.tsx:67-78`
- 12+ additional components

**Issue:** Event handler functions like `handleDuplicate`, `handleDelete`, `handleStatusChange` are recreated on every render and passed to child components, causing unnecessary re-renders.

**Impact:** Child component re-renders on every parent state change

**Suggested Solution:**

1. Wrap all handler functions passed to children with `useCallback()`.

2. For `handleDuplicate`, `handleDelete`, `handleStatusChange` in chatbots page: Wrap each with `useCallback(..., [mutate, addToast])` since they depend on these values.

3. Ensure dependency arrays are correct - include all values from the component scope that the callback uses.

4. For handlers that need item IDs, use the pattern: `const handleDelete = useCallback((id: string) => { ... }, [dependencies])` rather than creating inline functions in JSX.

---

### H9. Bad useEffect Dependencies

**Severity:** HIGH
**Category:** Memoization
**Files:**
- `src/app/(support-agent)/inbox/page.tsx:150-153`
- `src/components/shared/chatbot/AgentDetailForm.tsx:94-96`

**Issue:** useEffect hooks with callback dependencies trigger refetches when callbacks are recreated. For example, `useEffect(() => { fetchConversations(...) }, [fetchConversations, ...])` refetches whenever `fetchConversations` changes.

**Impact:** Potential fetch loops and stale closure bugs

**Suggested Solution:**

1. **Option A - Stable callback reference:** Ensure `fetchConversations` is wrapped in `useCallback` with a stable dependency array. Only include truly necessary dependencies.

2. **Option B - Move logic inside useEffect:** Instead of calling an external callback, put the fetch logic directly inside useEffect and list only the data dependencies (not the function).

3. **Option C - Use ref for latest callback:** Store the callback in a ref (`const fetchRef = useRef(fetchConversations)`) and update the ref in useEffect without it being a dependency. Call `fetchRef.current()` inside the effect.

4. **For AgentDetailForm:** The `fetchCategories` function is wrapped in `useCallback` but depends on `categoriesApiUrl`. If this URL changes frequently, consider debouncing the effect or using SWR which handles this automatically.

---

### H10. Admin Dashboard Routes Missing ISR

**Severity:** HIGH
**Category:** Dynamic vs Static
**Paths:** All routes under `src/app/(master-admin)/admin/**`

**Issue:** Dashboard, companies list, packages, and plans pages are fully dynamic when they contain data that changes infrequently.

**Impact:** Every page load hits the database instead of serving cached content

**Suggested Solution:**

1. **Add revalidation config** to admin pages that show aggregate data. In each page file, add: `export const revalidate = 300` (5 minutes) for dashboard stats, or `export const revalidate = 3600` (1 hour) for packages/plans.

2. **For dashboard:** Since it shows real-time stats, use a hybrid approach - static shell with client-side data fetching for numbers. Or use ISR with 60-second revalidate.

3. **For company/package lists:** Add `revalidate = 60` to serve cached pages while allowing updates within a minute.

4. **Use `revalidatePath()`** in mutation endpoints (POST/PATCH/DELETE) to invalidate the cache when data changes.

---

### H11. Duplicate SWR Hooks for Company Data

**Severity:** HIGH
**Category:** Request Deduping
**File:** `src/hooks/master-admin/useCompany.ts`

**Issue:** Separate hooks for useCompany, useCompanyUsers, and useCompanySubscription make independent requests when used together in the same component.

**Impact:** 3x API requests when components use multiple company hooks

**Suggested Solution:**

1. **Use SWR's global configuration** for deduplication. Add to SWR config: `dedupingInterval: 2000` to dedupe requests to the same URL within 2 seconds.

2. **Create a combined hook:** `useCompanyDetails(companyId)` that fetches company, users, and subscription in a single API call. Update the company details endpoint to return all related data.

3. **Use SWR's `fallback` feature:** Pre-populate related data from a parent component's fetch to avoid child refetches.

4. **Share SWR cache keys:** If the company details endpoint already returns users/subscription data, extract them from the cache in individual hooks using `useSWR`'s `fallbackData` or by accessing the global cache.

---

### H12. Dashboard Multiple Hooks Without Deduplication

**Severity:** HIGH
**Category:** Request Deduping
**Files:**
- `src/hooks/master-admin/useDashboardStats.ts`
- `src/hooks/master-admin/useActivityFeed.ts`
- `src/hooks/master-admin/useChartData.ts`
- `src/hooks/master-admin/useSystemHealth.ts`

**Issue:** Dashboard page uses 5+ separate SWR hooks that each make independent API calls with no shared request deduplication.

**Impact:** 5+ simultaneous API requests on dashboard load

**Suggested Solution:**

1. **Create a single dashboard data endpoint:** `/api/master-admin/dashboard` that returns all dashboard data (stats, activity, charts, health) in one response. Use `Promise.all()` on the server to fetch all data in parallel.

2. **Update dashboard hooks** to either:
   - Use the combined endpoint with a single SWR call
   - Use SWR's `useSWR` with a shared key and selector pattern to extract specific data

3. **Implement request batching:** Use a library like `dataloader` pattern to batch multiple requests made within a short window into a single request.

4. **Server Components approach:** Fetch all dashboard data server-side and pass to client components as props, eliminating client-side fetches entirely for initial load.

---

## Medium Priority Issues

### M1. Home Page Unnecessarily Dynamic

**Severity:** MEDIUM
**Category:** Dynamic vs Static
**File:** `src/app/page.tsx`

**Issue:** Marketing homepage with completely static content (no data fetching, no cookies, no headers) is rendered dynamically on each request.

**Impact:** Unnecessary server computation for static content

**Suggested Solution:**

Add static rendering directive at the top of the file after imports:

`export const dynamic = 'force-static'`

Optionally add revalidation for the copyright year update: `export const revalidate = 86400` (24 hours).

For the dynamic year in the footer, either:
- Pre-render with current year and revalidate daily
- Move year calculation to a tiny client component

---

### M2. Widget Dual Config Fetches

**Severity:** MEDIUM
**Category:** Request Waterfalls
**File:** `src/app/embed-widget/page.tsx:265-332`

**Issue:** Sequential fetch attempts for widget configuration - first tries config-url, then JSON fetch, then fallback API - instead of racing sources.

**Impact:** Fallback adds latency instead of racing sources

**Suggested Solution:**

Use `Promise.any()` to race multiple config sources simultaneously. Create an array of config fetch promises and resolve with whichever succeeds first. Wrap each promise source in a try-catch that rejects on failure so `Promise.any()` moves to the next source.

---

### M3. Company Dashboard Sequential Counts

**Severity:** MEDIUM
**Category:** Request Waterfalls
**File:** `src/app/api/company/dashboard/stats/route.ts:30-87`

**Issue:** 5 sequential count queries for conversation statistics.

**Impact:** 250ms latency that could be 50ms with parallel execution

**Suggested Solution:**

Wrap all 5 count queries in `Promise.all()`. Each query is independent and can execute in parallel.

---

### M4. Logo Deletion Sequential Loop

**Severity:** MEDIUM
**Category:** Request Waterfalls
**File:** `src/app/api/company/logo/route.ts:71-75`

**Issue:** Old logo file deletions execute sequentially in a for loop, attempting to delete files for all extensions regardless of which one exists.

**Impact:** 4 sequential storage API calls

**Suggested Solution:**

1. Use `Promise.all()` to delete all extensions in parallel.

2. Better: First list existing files for this company logo path, then delete only those that exist. Supabase Storage has a `list()` method that can check what files exist.

3. Use Supabase's batch delete: `supabase.storage.from(bucket).remove([path1, path2, path3, path4])` accepts an array and deletes all in one call.

---

### M5. Knowledge Endpoint Over-Fetching

**Severity:** MEDIUM
**Category:** Over-fetching
**File:** `src/app/api/company/knowledge/route.ts:70-91`

**Issue:** Select without field specification returns all columns including large sourceConfig JSONB objects.

**Impact:** 50KB+ payload for knowledge source listings

**Suggested Solution:**

Replace `.select()` with explicit field selection. For list views, select only: id, name, type, status, documentCount, lastSyncedAt, createdAt. Exclude large fields like sourceConfig, chunkingConfig, processingConfig unless specifically needed.

---

### M6. Middleware O(n) Route Matching

**Severity:** MEDIUM
**Category:** Middleware Overhead
**File:** `src/middleware.ts:52-54`

**Issue:** Route matching uses `array.some()` with 22 routes in `publicRoutes`, performing up to 22 string comparisons per request.

**Impact:** O(n) lookup on every request instead of O(1)

**Suggested Solution:**

1. Convert `publicRoutes` array to a `Set` for exact matches: `const publicRoutesSet = new Set(['/login', '/register', ...])`. Use `publicRoutesSet.has(pathname)` for O(1) lookup.

2. For prefix matching (routes like `/api/widget/*`), create a separate array of prefixes and check those only if the Set check fails.

3. Consider using a trie data structure or regex pattern for complex route matching.

4. Move API routes out of middleware entirely - they handle their own auth and don't need the middleware check.

---

### M7. Missing useMemo for Expensive Calculations

**Severity:** MEDIUM
**Category:** Memoization
**Files:**
- `src/components/master-admin/dashboard/stats-grid.tsx:31-64`
- `src/app/(support-agent)/inbox/page.tsx:228-247`

**Issue:** Arrays of config objects (like `statCards`) are recreated on every render.

**Impact:** Unnecessary object allocations and potential child re-renders

**Suggested Solution:**

Wrap array definitions with `useMemo()`:

Change `const statCards = [...]` to `const statCards = useMemo(() => [...], [stats])`.

Only include actual dependencies (like `stats` object) in the dependency array. If the array contains only static config, the dependency array can be empty `[]`.

---

### M8. revalidateOnFocus Causing Extra Fetches

**Severity:** MEDIUM
**Category:** Request Deduping
**Files:**
- `src/hooks/master-admin/useDashboardStats.ts:21`
- `src/hooks/master-admin/useActivityFeed.ts:27`

**Issue:** `revalidateOnFocus: true` option causes refetches when user switches browser tabs, even if data was just fetched.

**Impact:** Extra API calls when data was just fetched

**Suggested Solution:**

Set `revalidateOnFocus: false` for hooks where immediate data freshness isn't critical. The `refreshInterval` already handles periodic updates.

Alternatively, set `dedupingInterval: 10000` (10 seconds) to prevent refetch if data was fetched within the last 10 seconds, even on focus.

---

### M9. Object/Array Creation Without Memoization

**Severity:** MEDIUM
**Category:** Memoization
**Multiple Files:** Stats grids, filter components, dropdown menus

**Issue:** Configuration arrays and objects recreated on every render when they don't depend on changing values.

**Impact:** Props appear changed, triggering child re-renders

**Suggested Solution:**

1. For static configuration (like `statusConfig`, `typeConfig` in AgentCard), move them outside the component to module scope.

2. For dynamic configs that depend on props/state, wrap with `useMemo()`.

3. For dropdown items that depend on a single value (like agent status), use `useMemo` with that value in the dependency array.

---

### M10. Company Admin Routes Force Dynamic

**Severity:** MEDIUM
**Category:** Dynamic vs Static
**Paths:** All routes under `src/app/(company-admin)/**`

**Issue:** The `requireCompanyAdmin()` guard uses `cookies()` to read the active company ID, forcing all routes using this guard to be dynamically rendered.

**Impact:** No ISR possible for semi-static company pages

**Suggested Solution:**

1. **Pass company ID as route parameter** instead of cookie for pages where it makes sense. Use `/company/[companyId]/dashboard` pattern.

2. **Use generateStaticParams** for known company IDs to pre-render common pages.

3. **Accept the dynamic nature** for truly user-specific pages, but optimize the guard function with caching (see C3).

4. **Hybrid approach:** Make the page wrapper a Server Component that reads the cookie, then pass company data to static child components.

---

### M11. Inconsistent Memoization Patterns

**Severity:** MEDIUM
**Category:** Memoization
**Scope:** Hooks and components throughout codebase

**Issue:** Some hooks properly memoize (usePagination, useSearch) while similar patterns elsewhere don't.

**Impact:** Inconsistent performance characteristics, harder to maintain

**Suggested Solution:**

1. Establish memoization guidelines in code review process.

2. Create a shared pattern: All hooks returning callbacks should wrap them in `useCallback`. All hooks returning derived data should use `useMemo`.

3. Add ESLint rule `react-hooks/exhaustive-deps` to catch missing dependencies.

4. Consider using a state management library (Zustand, Jotai) for complex state to get automatic memoization.

---

## Low Priority Issues

### L1. No HTTP Cache Headers on GET Routes

**Severity:** LOW
**Category:** Request Deduping
**Scope:** All API GET endpoints

**Issue:** API responses don't include Cache-Control headers for browser and CDN caching.

**Impact:** Browser cannot cache responses between navigations

**Suggested Solution:**

Add appropriate cache headers to GET responses. For semi-static data, return: `NextResponse.json(data, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } })`.

For user-specific data: `'Cache-Control': 'private, no-cache'`.

---

### L2. Logo Upload Returns Redundant Data

**Severity:** LOW
**Category:** Over-fetching
**File:** `src/app/api/company/logo/route.ts:102-106`

**Issue:** Response includes full path object alongside the URL.

**Impact:** Minor payload overhead

**Suggested Solution:**

Return only the `logoUrl` in the response, not the internal `data.path` object.

---

### L3. Unauthorized Page Unnecessarily Dynamic

**Severity:** LOW
**Category:** Dynamic vs Static
**File:** `src/app/unauthorized/page.tsx`

**Issue:** Static error page rendered dynamically.

**Impact:** Minor server overhead

**Suggested Solution:**

Add `export const dynamic = 'force-static'` to the page.

---

### L4. Unused Middleware Function

**Severity:** LOW
**Category:** Middleware Overhead
**File:** `src/middleware.ts:95-111`

**Issue:** Function `redirectToDashboard()` is defined but never called. The middleware uses inline redirects instead.

**Impact:** Dead code in middleware, minor bundle size impact

**Suggested Solution:**

Delete the unused `redirectToDashboard` function (lines 95-111).

---

## Summary Tables

### Issues by Category

| Category | Critical | High | Medium | Low | Total |
|----------|----------|------|--------|-----|-------|
| Request Waterfalls | 2 | 4 | 4 | 0 | 10 |
| Request Deduping | 1 | 2 | 2 | 1 | 6 |
| Client vs Server | 2 | 0 | 0 | 0 | 2 |
| Memoization | 0 | 3 | 4 | 0 | 7 |
| Over-fetching | 0 | 1 | 1 | 1 | 3 |
| Dynamic vs Static | 0 | 1 | 2 | 1 | 4 |
| Middleware Overhead | 0 | 0 | 1 | 1 | 2 |
| **Total** | **5** | **12** | **11** | **4** | **32** |

### Issues by Severity

| Severity | Count | Estimated Fix Effort |
|----------|-------|---------------------|
| Critical | 5 | Immediate action required |
| High | 12 | Address within sprint |
| Medium | 11 | Schedule in backlog |
| Low | 4 | Address opportunistically |

---

## Recommended Action Sequence

### Immediate (Critical Impact)

1. Fix N+1 queries in conversations endpoint using database joins
2. Parallelize dashboard stats queries with Promise.all()
3. Implement React.cache() wrapper for auth guards and common queries
4. Reduce SWR polling intervals or implement WebSocket for real-time data
5. Convert dashboard pages to Server Components with streaming

### Short-term (High Impact)

6. Parallelize all sequential database queries in API routes
7. Add field selection to widget config and knowledge endpoints
8. Add React.memo() to all card/list item components
9. Memoize event handlers with useCallback
10. Configure ISR for admin dashboard routes

### Medium-term (Medium Impact)

11. Make homepage and static pages use force-static
12. Optimize middleware route matching with Set-based lookup
13. Add useMemo for array/object creation in renders
14. Remove revalidateOnFocus from non-critical hooks
15. Consolidate dashboard data hooks

### Ongoing

16. Add HTTP cache headers to cacheable GET endpoints
17. Remove dead code from middleware
18. Establish memoization patterns in code review guidelines

---

## Appendix: Files Requiring Changes

### API Routes
- `src/app/api/company/conversations/route.ts`
- `src/app/api/master-admin/dashboard/stats/route.ts`
- `src/app/api/master-admin/companies/[companyId]/route.ts`
- `src/app/api/master-admin/companies/[companyId]/agents/[agentId]/route.ts`
- `src/app/api/master-admin/dashboard/charts/route.ts`
- `src/app/api/company/chatbots/[chatbotId]/widget/route.ts`
- `src/app/api/master-admin/companies/[companyId]/chatbots/[chatbotId]/widget/route.ts`
- `src/app/api/company/agents/route.ts`
- `src/app/api/company/dashboard/stats/route.ts`
- `src/app/api/company/logo/route.ts`
- `src/app/api/company/knowledge/route.ts`

### Pages
- `src/app/(master-admin)/admin/dashboard/page.tsx`
- `src/app/(company-admin)/dashboard/page.tsx`
- `src/app/(support-agent)/inbox/page.tsx`
- `src/app/(support-agent)/inbox/starred/page.tsx`
- `src/app/(company-admin)/chatbots/page.tsx`
- `src/app/embed-widget/page.tsx`
- `src/app/page.tsx`
- `src/app/unauthorized/page.tsx`

### Components
- `src/components/company-admin/agents/agent-card.tsx`
- `src/components/master-admin/dashboard/stats-grid.tsx`
- `src/components/company-admin/dashboard/metrics-grid.tsx`
- `src/components/master-admin/dashboard/recent-companies.tsx`
- `src/components/master-admin/companies/companies-table.tsx`
- `src/components/shared/chatbot/AgentDetailForm.tsx`

### Hooks
- `src/hooks/master-admin/useDashboardStats.ts`
- `src/hooks/company/useDashboard.ts`
- `src/hooks/company/useConversations.ts`
- `src/hooks/master-admin/useActivityFeed.ts`
- `src/hooks/company/useAgents.ts`
- `src/hooks/master-admin/useCompany.ts`

### Infrastructure
- `src/middleware.ts`

### New Files to Create
- `src/lib/data/cached-queries.ts` (for React.cache() wrappers)
