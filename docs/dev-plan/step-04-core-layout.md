# Step 04: Core Layout & Shared Components

## Objective
Create the foundational layout components, navigation systems, and shared UI components that will be used across all three portals (Master Admin, Company Admin, Support Agent).

---

## Prerequisites
- Steps 01-03 completed
- Authentication system working
- HeroUI configured

---

## Reference Documents
- [UI Overview](../ui/00-overview.md)
- All portal UI specifications

---

## Tasks

### 4.1 Create Base UI Component Wrappers

Wrap HeroUI components with consistent styling and behavior:

**`src/components/ui/button.tsx`:**
- Extends HeroUI Button
- Adds loading state with spinner
- Icon support (Lucide)
- Consistent variants

**`src/components/ui/input.tsx`:**
- Extends HeroUI Input
- Error state styling
- Label integration
- Helper text

**`src/components/ui/select.tsx`:**
- Extends HeroUI Select
- Async loading support
- Search/filter capability

**`src/components/ui/modal.tsx`:**
- Extends HeroUI Modal
- Framer Motion animations
- Standard sizes (sm, md, lg, xl)
- Confirmation dialog variant

**`src/components/ui/card.tsx`:**
- Extends HeroUI Card
- Stat card variant
- Clickable card variant

**`src/components/ui/table.tsx`:**
- Extends HeroUI Table
- Sorting headers
- Pagination integration
- Empty state
- Loading skeleton

**`src/components/ui/badge.tsx`:**
- Status badges
- Tag badges
- Count badges

**`src/components/ui/avatar.tsx`:**
- User avatar with fallback
- Status indicator
- Group avatar

**`src/components/ui/tabs.tsx`:**
- Extends HeroUI Tabs
- URL-synced tabs option
- Icon tabs

**`src/components/ui/dropdown.tsx`:**
- Extends HeroUI Dropdown
- Menu items with icons
- Danger item variant

**`src/components/ui/tooltip.tsx`:**
- Extends HeroUI Tooltip
- Consistent delay

**`src/components/ui/skeleton.tsx`:**
- Loading skeletons
- Various shapes

**`src/components/ui/empty-state.tsx`:**
- Empty state component
- Icon, title, description, action

### 4.2 Create Layout Components

**`src/components/layouts/sidebar.tsx`:**
```
┌─────────────────────┐
│  [Logo]             │
│                     │
│  SECTION HEADER     │
│  ─────────────────  │
│  ○ Nav Item 1       │
│  ● Nav Item 2       │  ← Active
│  ○ Nav Item 3       │
│                     │
│  SECTION HEADER     │
│  ─────────────────  │
│  ○ Nav Item 4       │
│  ○ Nav Item 5       │
│                     │
│  ─────────────────  │
│  [Collapse Button]  │
└─────────────────────┘
```

Features:
- Collapsible sidebar
- Section headers
- Active state tracking
- Icon + text items
- Badge counts
- Mobile drawer mode

**`src/components/layouts/header.tsx`:**
```
┌─────────────────────────────────────────────────────────────────────┐
│  [☰] [Logo] Company Name        [🔍] [...] [?] [🔔 3] [Avatar ▼]    │
└─────────────────────────────────────────────────────────────────────┘
```

Features:
- Mobile menu toggle
- Search bar (expandable)
- Help button
- Notifications dropdown
- User menu dropdown
- Company name (for company portals)

**`src/components/layouts/page-header.tsx`:**
```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  Page Title                                          [Action Button]│
│  Optional description text                                          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

Features:
- Title
- Description (optional)
- Breadcrumbs (optional)
- Action buttons slot
- Back button (optional)

**`src/components/layouts/main-layout.tsx`:**
- Combines sidebar + header + main content
- Responsive behavior
- Content wrapper with padding

### 4.3 Create Portal-Specific Layouts

**`src/app/(master-admin)/layout.tsx`:**
```typescript
// Master admin layout
- MasterAdminSidebar navigation items
- MasterAdminHeader
- Access check (requireMasterAdmin)
```

**Navigation items:**
- Dashboard
- Companies
- Subscription Plans
- Agent Packages
- Platform Analytics
- Audit Logs
- System Settings

**`src/app/(company-admin)/layout.tsx`:**
```typescript
// Company admin layout
- CompanyAdminSidebar navigation items
- CompanyAdminHeader (with company name)
- Access check (requireCompanyAdmin)
```

**Navigation items:**
- MAIN: Dashboard, Agents, Knowledge, Conversations
- CONFIGURE: Widget, Integrations, Settings, Billing
- TEAM: Team Management

**`src/app/(support-agent)/layout.tsx`:**
```typescript
// Support agent layout
- SupportAgentSidebar navigation items
- SupportAgentHeader (with status selector)
- Access check (requireSupportAgent)
```

**Navigation items:**
- INBOX: My Inbox, Unassigned
- QUICK ACCESS: Starred, All Resolved
- Canned Responses, My Settings

### 4.4 Create Shared Components

**`src/components/shared/search-input.tsx`:**
- Search input with debounce
- Clear button
- Loading indicator
- Keyboard shortcut hint

**`src/components/shared/date-picker.tsx`:**
- Date picker component
- Date range picker
- Preset ranges

**`src/components/shared/file-upload.tsx`:**
- Drag and drop zone
- File type validation
- Progress indicator
- Multiple file support

**`src/components/shared/color-picker.tsx`:**
- Color selection
- Preset colors
- Custom color input

**`src/components/shared/rich-text-editor.tsx`:**
- Basic text formatting
- Link insertion
- Emoji picker integration

**`src/components/shared/stat-card.tsx`:**
```
┌─────────────────────┐
│  Total Users        │
│                     │
│  1,234              │
│  ↑ 12% from last    │
│     month           │
└─────────────────────┘
```

Features:
- Title, value, change indicator
- Trend icon
- Optional chart sparkline

**`src/components/shared/notification-dropdown.tsx`:**
- Notification list
- Unread indicator
- Mark as read
- View all link

**`src/components/shared/user-menu.tsx`:**
- User info
- Quick links
- Sign out

**`src/components/shared/confirmation-dialog.tsx`:**
- Reusable confirmation modal
- Danger variant for destructive actions
- Custom messages

### 4.5 Create Form Components

**`src/components/forms/form-field.tsx`:**
- Label + input wrapper
- Error message display
- Required indicator
- Help text

**`src/components/forms/form-section.tsx`:**
- Section with title
- Description
- Divider

**`src/components/forms/form-actions.tsx`:**
- Form action buttons
- Sticky on long forms
- Cancel + Submit pattern

### 4.6 Create Chart Components

**`src/components/charts/line-chart.tsx`:**
- Time series data
- Multiple lines
- Tooltip
- Legend

**`src/components/charts/bar-chart.tsx`:**
- Vertical/horizontal bars
- Grouped bars
- Stacked option

**`src/components/charts/donut-chart.tsx`:**
- Percentage display
- Legend
- Center text

**`src/components/charts/sparkline.tsx`:**
- Mini chart for stat cards
- Trend indication

**Note:** Use a lightweight chart library (recharts or similar) that works well with React.

### 4.7 Create Animation Utilities

**`src/lib/animations/variants.ts`:**
```typescript
// Framer Motion variants
export const fadeIn = {...}
export const slideIn = {...}
export const scaleIn = {...}
export const staggerContainer = {...}
export const listItem = {...}
```

**`src/lib/animations/transitions.ts`:**
```typescript
// Reusable transitions
export const springTransition = {...}
export const smoothTransition = {...}
```

**`src/components/shared/animated-list.tsx`:**
- AnimatePresence wrapper
- Staggered list items
- Exit animations

**`src/components/shared/page-transition.tsx`:**
- Page enter/exit animations
- Layout animations

### 4.8 Create Loading States

**`src/components/shared/page-loading.tsx`:**
- Full page loading spinner
- Loading message

**`src/components/shared/section-loading.tsx`:**
- Section skeleton
- Table skeleton
- Card skeleton

**`src/components/shared/button-loading.tsx`:**
- Button with spinner
- Disabled state during load

### 4.9 Create Error Handling Components

**`src/components/shared/error-boundary.tsx`:**
- React error boundary
- Fallback UI
- Error reporting

**`src/components/shared/error-message.tsx`:**
- Error display component
- Retry button
- Different severities

**`src/app/error.tsx`:**
- Global error page
- Reset functionality

**`src/app/not-found.tsx`:**
- 404 page
- Navigation suggestions

### 4.10 Implement Theme Support

**`src/lib/theme/theme-provider.tsx`:**
- Light/dark mode toggle
- System preference detection
- Persistence in localStorage

**`src/components/shared/theme-toggle.tsx`:**
- Theme switcher button
- Icon changes based on mode

### 4.11 Create Utility Hooks

**`src/hooks/useMediaQuery.ts`:**
- Responsive breakpoint detection

**`src/hooks/useDebounce.ts`:**
- Debounced value hook

**`src/hooks/useLocalStorage.ts`:**
- Local storage state hook

**`src/hooks/useClickOutside.ts`:**
- Click outside detection

**`src/hooks/usePagination.ts`:**
- Pagination state management

**`src/hooks/useSearch.ts`:**
- Search with debounce and loading

---

## Responsive Breakpoints

| Breakpoint | Width | Usage |
|------------|-------|-------|
| sm | 640px | Mobile landscape |
| md | 768px | Tablet |
| lg | 1024px | Small desktop |
| xl | 1280px | Desktop |
| 2xl | 1536px | Large desktop |

**Mobile behavior:**
- Sidebar becomes drawer
- Header shows hamburger menu
- Tables become cards
- Modals become full-screen

---

## Component Naming Conventions

- PascalCase for components
- Descriptive names (e.g., `UserAvatarWithStatus`)
- Prefix with context if needed (e.g., `AdminSidebar`)
- Export from index files

---

## Validation Checklist

- [ ] All UI components render correctly
- [ ] Sidebar navigation works
- [ ] Header components work
- [ ] Theme toggle works
- [ ] Responsive behavior works
- [ ] Animations are smooth
- [ ] Loading states display correctly
- [ ] Error boundaries catch errors
- [ ] Charts render data correctly

---

## File Structure

```
src/
├── components/
│   ├── ui/
│   │   ├── index.ts
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── select.tsx
│   │   ├── modal.tsx
│   │   ├── card.tsx
│   │   ├── table.tsx
│   │   ├── badge.tsx
│   │   ├── avatar.tsx
│   │   ├── tabs.tsx
│   │   ├── dropdown.tsx
│   │   ├── tooltip.tsx
│   │   ├── skeleton.tsx
│   │   └── empty-state.tsx
│   │
│   ├── layouts/
│   │   ├── index.ts
│   │   ├── sidebar.tsx
│   │   ├── header.tsx
│   │   ├── page-header.tsx
│   │   ├── main-layout.tsx
│   │   ├── master-admin-layout.tsx
│   │   ├── company-admin-layout.tsx
│   │   └── support-agent-layout.tsx
│   │
│   ├── forms/
│   │   ├── index.ts
│   │   ├── form-field.tsx
│   │   ├── form-section.tsx
│   │   └── form-actions.tsx
│   │
│   ├── charts/
│   │   ├── index.ts
│   │   ├── line-chart.tsx
│   │   ├── bar-chart.tsx
│   │   ├── donut-chart.tsx
│   │   └── sparkline.tsx
│   │
│   └── shared/
│       ├── index.ts
│       ├── search-input.tsx
│       ├── date-picker.tsx
│       ├── file-upload.tsx
│       ├── color-picker.tsx
│       ├── rich-text-editor.tsx
│       ├── stat-card.tsx
│       ├── notification-dropdown.tsx
│       ├── user-menu.tsx
│       ├── confirmation-dialog.tsx
│       ├── animated-list.tsx
│       ├── page-transition.tsx
│       ├── page-loading.tsx
│       ├── section-loading.tsx
│       ├── error-boundary.tsx
│       ├── error-message.tsx
│       └── theme-toggle.tsx
│
├── lib/
│   ├── animations/
│   │   ├── variants.ts
│   │   └── transitions.ts
│   └── theme/
│       └── theme-provider.tsx
│
├── hooks/
│   ├── useMediaQuery.ts
│   ├── useDebounce.ts
│   ├── useLocalStorage.ts
│   ├── useClickOutside.ts
│   ├── usePagination.ts
│   └── useSearch.ts
│
└── app/
    ├── error.tsx
    ├── not-found.tsx
    ├── (master-admin)/
    │   └── layout.tsx
    ├── (company-admin)/
    │   └── layout.tsx
    └── (support-agent)/
        └── layout.tsx
```

---

## Next Step
[Step 05 - Master Admin Dashboard](./step-05-master-dashboard.md)

---

## Related Documentation
- [UI Overview](../ui/00-overview.md)
- [Architecture Overview](../architecture-overview.md)
