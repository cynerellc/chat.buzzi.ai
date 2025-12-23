# Step 01: Project Setup & Configuration

## Objective
Initialize the Next.js project with all required dependencies, configure TypeScript, set up the development environment, and establish the foundational project structure.

---

## Prerequisites
- Node.js 18+ installed
- pnpm/npm/yarn package manager
- PostgreSQL database (local or cloud)
- Supabase account
- OpenAI/Anthropic API key

---

## Tasks

### 1.1 Initialize Next.js Project

Create a new Next.js 15+ project with the App Router:

**Configuration options:**
- TypeScript: Yes
- ESLint: Yes
- Tailwind CSS: Yes
- `src/` directory: Yes
- App Router: Yes
- Import alias: `@/*`

### 1.2 Install Core Dependencies

**UI & Styling:**
- `@heroui/react` - UI component library
- `lucide-react` - Icon library
- `framer-motion` - Animation library
- `tailwind-variants` - Tailwind utility
- `clsx` - Classname utility
- `tailwind-merge` - Tailwind class merging

**Database & Auth:**
- `drizzle-orm` - ORM
- `drizzle-kit` - Drizzle CLI tools
- `postgres` - PostgreSQL driver
- `@supabase/supabase-js` - Supabase client
- `@supabase/ssr` - Supabase SSR helpers

**AI & Embeddings:**
- `openai` - OpenAI SDK
- `@anthropic-ai/sdk` - Anthropic SDK
- `ai` - Vercel AI SDK

**Utilities:**
- `zod` - Schema validation
- `date-fns` - Date utilities
- `uuid` - UUID generation
- `zustand` - State management
- `react-hook-form` - Form handling
- `@hookform/resolvers` - Form resolvers

**Development:**
- `@types/node` - Node types
- `@types/react` - React types
- `@types/uuid` - UUID types

### 1.3 Configure Environment Variables

Create `.env.local` with required variables:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/chatbuzzi

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# AI Providers
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_WIDGET_URL=http://localhost:3000/widget
```

Create `.env.example` as a template (without actual values).

### 1.4 Configure TypeScript

Update `tsconfig.json` with strict settings and path aliases:

**Key configurations:**
- `strict: true`
- `noUncheckedIndexedAccess: true`
- Path aliases for `@/lib/*`, `@/components/*`, `@/hooks/*`, `@/types/*`, `@/stores/*`

### 1.5 Configure Tailwind CSS

Update `tailwind.config.ts`:

**Include:**
- HeroUI plugin integration
- Custom color scheme (brand colors)
- Extended spacing/typography if needed
- Dark mode configuration (`class` strategy)
- Animation utilities

### 1.6 Configure ESLint

Update `.eslintrc.json` with:

- Next.js recommended rules
- TypeScript recommended rules
- Import ordering rules
- React hooks rules

### 1.7 Create Base Folder Structure

```
src/
├── app/
│   ├── (auth)/
│   ├── (master-admin)/
│   ├── (company-admin)/
│   ├── (support-agent)/
│   ├── api/
│   ├── widget/
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
│
├── components/
│   ├── ui/
│   ├── layouts/
│   ├── forms/
│   ├── charts/
│   └── shared/
│
├── lib/
│   ├── db/
│   ├── auth/
│   ├── ai/
│   ├── realtime/
│   └── utils/
│
├── hooks/
├── stores/
├── types/
└── styles/
```

### 1.8 Create Base Utility Functions

**`src/lib/utils/cn.ts`:**
- Combine `clsx` and `tailwind-merge` for className utility

**`src/lib/utils/format.ts`:**
- Date formatting helpers
- Number formatting helpers
- String utilities

### 1.9 Configure HeroUI Provider

Create provider wrapper for HeroUI that:
- Wraps the application
- Handles theme switching
- Configures default props

### 1.10 Create Base Types

**`src/types/index.ts`:**
- Export all type definitions
- Create base types for API responses
- Define common interfaces

**`src/types/api.ts`:**
- API response wrapper types
- Pagination types
- Error types

### 1.11 Configure Drizzle

**`drizzle.config.ts`:**
- Database connection
- Schema location
- Migration output directory

**`src/lib/db/index.ts`:**
- Database client initialization
- Connection pooling setup

### 1.12 Set Up Git Hooks (Optional)

Configure pre-commit hooks with:
- Lint-staged for ESLint
- Type checking
- Prettier formatting

---

## File Structure After Completion

```
chat.buzzi.ai/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   └── .gitkeep
│   │   ├── (master-admin)/
│   │   │   └── .gitkeep
│   │   ├── (company-admin)/
│   │   │   └── .gitkeep
│   │   ├── (support-agent)/
│   │   │   └── .gitkeep
│   │   ├── api/
│   │   │   └── .gitkeep
│   │   ├── widget/
│   │   │   └── .gitkeep
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── globals.css
│   │
│   ├── components/
│   │   ├── ui/
│   │   │   └── index.ts
│   │   ├── layouts/
│   │   │   └── index.ts
│   │   ├── forms/
│   │   │   └── index.ts
│   │   └── shared/
│   │       └── index.ts
│   │
│   ├── lib/
│   │   ├── db/
│   │   │   └── index.ts
│   │   ├── auth/
│   │   │   └── index.ts
│   │   ├── utils/
│   │   │   ├── cn.ts
│   │   │   └── format.ts
│   │   └── constants.ts
│   │
│   ├── hooks/
│   │   └── index.ts
│   │
│   ├── stores/
│   │   └── index.ts
│   │
│   ├── types/
│   │   ├── index.ts
│   │   └── api.ts
│   │
│   └── providers/
│       └── index.tsx
│
├── public/
│   └── .gitkeep
│
├── .env.local
├── .env.example
├── .eslintrc.json
├── .gitignore
├── drizzle.config.ts
├── next.config.js
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── README.md
```

---

## Validation Checklist

- [ ] Project runs with `npm run dev`
- [ ] TypeScript compiles without errors
- [ ] ESLint passes without errors
- [ ] Tailwind CSS classes work correctly
- [ ] HeroUI components render correctly
- [ ] Environment variables load correctly
- [ ] Database connection initializes
- [ ] Folder structure is created

---

## Dependencies Summary

```json
{
  "dependencies": {
    "@heroui/react": "^2.x",
    "@supabase/supabase-js": "^2.x",
    "@supabase/ssr": "^0.x",
    "ai": "^3.x",
    "clsx": "^2.x",
    "date-fns": "^3.x",
    "drizzle-orm": "^0.x",
    "framer-motion": "^11.x",
    "lucide-react": "^0.x",
    "openai": "^4.x",
    "postgres": "^3.x",
    "react-hook-form": "^7.x",
    "tailwind-merge": "^2.x",
    "uuid": "^9.x",
    "zod": "^3.x",
    "zustand": "^4.x"
  },
  "devDependencies": {
    "@types/node": "^20.x",
    "@types/react": "^18.x",
    "@types/uuid": "^9.x",
    "drizzle-kit": "^0.x",
    "typescript": "^5.x"
  }
}
```

---

## Next Step
[Step 02 - Database Schema Implementation](./step-02-database-schema.md)

---

## Related Documentation
- [Architecture Overview](../architecture-overview.md)
- [Requirements](../requirement.v2.md)
