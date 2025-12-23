# Step 25: Testing & Deployment

## Objective
Implement comprehensive testing strategies (unit, integration, E2E), set up CI/CD pipelines, configure production deployment, and establish monitoring and observability for the platform.

---

## Prerequisites
- All previous steps (1-24) completed
- GitHub repository configured
- Vercel/AWS account for deployment
- Monitoring service accounts (Sentry, etc.)

---

## Tasks

### 25.1 Testing Strategy Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            TESTING PYRAMID                                       │
└─────────────────────────────────────────────────────────────────────────────────┘

                           ┌───────────┐
                          /             \
                         /    E2E        \     10%
                        /   Tests         \    Playwright
                       /───────────────────\
                      /                     \
                     /    Integration        \   30%
                    /       Tests             \  API, DB
                   /───────────────────────────\
                  /                             \
                 /         Unit Tests            \  60%
                /         Vitest/Jest             \ Components, Utils
               /───────────────────────────────────\
```

### 25.2 Unit Testing Setup

**Directory:** `__tests__/unit/`

**Configuration:**
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', '__tests__/', '**/*.d.ts'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

**Areas to Test:**
- Utility functions
- React hooks
- Component rendering
- State management
- Form validation
- Data transformations

**Example Unit Test:**
```typescript
// __tests__/unit/lib/utils.test.ts
import { describe, it, expect } from 'vitest';
import { formatCurrency, truncateText, generateSlug } from '@/lib/utils';

describe('formatCurrency', () => {
  it('formats USD currency correctly', () => {
    expect(formatCurrency(1234.56, 'USD')).toBe('$1,234.56');
  });

  it('handles zero amount', () => {
    expect(formatCurrency(0, 'USD')).toBe('$0.00');
  });
});
```

### 25.3 Integration Testing Setup

**Directory:** `__tests__/integration/`

**API Route Testing:**
```typescript
// __tests__/integration/api/agents.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDatabase, seedTestData, cleanupTestDatabase } from '../helpers';

describe('Agents API', () => {
  beforeAll(async () => {
    await createTestDatabase();
    await seedTestData();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  it('GET /api/company/agents returns agent list', async () => {
    const response = await fetch('/api/company/agents', {
      headers: { Authorization: `Bearer ${testToken}` },
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.agents).toBeInstanceOf(Array);
  });

  it('POST /api/company/agents creates new agent', async () => {
    const response = await fetch('/api/company/agents', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${testToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Test Agent',
        description: 'A test agent',
        systemPrompt: 'You are a helpful assistant.',
      }),
    });

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.agent.name).toBe('Test Agent');
  });
});
```

**Database Testing:**
```typescript
// __tests__/integration/db/agents.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { agents } from '@/lib/db/schema';

describe('Agents Database Operations', () => {
  beforeEach(async () => {
    await db.delete(agents);
  });

  it('creates agent with correct schema', async () => {
    const result = await db.insert(agents).values({
      name: 'Test Agent',
      companyId: 'company_123',
      type: 'support',
      status: 'draft',
    }).returning();

    expect(result[0].id).toBeDefined();
    expect(result[0].createdAt).toBeDefined();
  });
});
```

### 25.4 End-to-End Testing Setup

**Directory:** `__tests__/e2e/`

**Playwright Configuration:**
```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './__tests__/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

**E2E Test Examples:**

**Authentication Flow:**
```typescript
// __tests__/e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('user can login with valid credentials', async ({ page }) => {
    await page.goto('/login');

    await page.fill('[data-testid="email"]', 'test@example.com');
    await page.fill('[data-testid="password"]', 'password123');
    await page.click('[data-testid="login-button"]');

    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
  });

  test('shows error for invalid credentials', async ({ page }) => {
    await page.goto('/login');

    await page.fill('[data-testid="email"]', 'wrong@example.com');
    await page.fill('[data-testid="password"]', 'wrongpassword');
    await page.click('[data-testid="login-button"]');

    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
  });
});
```

**Agent Management Flow:**
```typescript
// __tests__/e2e/agents.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Agent Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login as company admin
    await loginAsCompanyAdmin(page);
  });

  test('can create a new agent', async ({ page }) => {
    await page.goto('/company/agents');
    await page.click('[data-testid="create-agent-button"]');

    await page.fill('[data-testid="agent-name"]', 'Support Bot');
    await page.fill('[data-testid="agent-description"]', 'Customer support agent');
    await page.click('[data-testid="save-agent-button"]');

    await expect(page.locator('text=Support Bot')).toBeVisible();
  });
});
```

**Chat Widget Flow:**
```typescript
// __tests__/e2e/widget.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Chat Widget', () => {
  test('widget opens and sends message', async ({ page }) => {
    // Load page with widget embedded
    await page.goto('/test-widget');

    // Click launcher
    await page.click('#buzzi-chat-widget .buzzi-launcher');

    // Verify chat window opens
    await expect(page.locator('.buzzi-chat-window')).toBeVisible();

    // Send message
    await page.fill('.buzzi-input', 'Hello, I need help');
    await page.click('.buzzi-send');

    // Verify message appears
    await expect(page.locator('.buzzi-message-user')).toContainText('Hello, I need help');

    // Wait for response
    await expect(page.locator('.buzzi-message-assistant')).toBeVisible({ timeout: 30000 });
  });
});
```

### 25.5 Test Data Factories

**File:** `__tests__/factories/`

```typescript
// __tests__/factories/user.ts
import { faker } from '@faker-js/faker';

export function createUserFactory(overrides = {}) {
  return {
    id: faker.string.uuid(),
    email: faker.internet.email(),
    name: faker.person.fullName(),
    role: 'company_admin',
    companyId: faker.string.uuid(),
    ...overrides,
  };
}

// __tests__/factories/agent.ts
export function createAgentFactory(overrides = {}) {
  return {
    id: faker.string.uuid(),
    name: faker.company.buzzPhrase(),
    description: faker.lorem.sentence(),
    type: 'support',
    status: 'active',
    ...overrides,
  };
}
```

### 25.6 CI/CD Pipeline Setup

**GitHub Actions Workflow:**
```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm lint

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm typecheck

  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm test:unit
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json

  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test
        ports:
          - 5432:5432
      redis:
        image: redis:7
        ports:
          - 6379:6379
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm test:integration
        env:
          DATABASE_URL: postgres://test:test@localhost:5432/test
          REDIS_URL: redis://localhost:6379

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm exec playwright install --with-deps
      - run: pnpm test:e2e
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/

  build:
    runs-on: ubuntu-latest
    needs: [lint, typecheck, unit-tests]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm build
```

### 25.7 Deployment Configuration

**Vercel Configuration:**
```json
// vercel.json
{
  "buildCommand": "pnpm build",
  "outputDirectory": ".next",
  "framework": "nextjs",
  "regions": ["iad1"],
  "env": {
    "DATABASE_URL": "@database-url",
    "SUPABASE_URL": "@supabase-url",
    "SUPABASE_SERVICE_KEY": "@supabase-service-key",
    "OPENAI_API_KEY": "@openai-api-key",
    "REDIS_URL": "@redis-url",
    "STRIPE_SECRET_KEY": "@stripe-secret-key"
  },
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Access-Control-Allow-Origin", "value": "*" },
        { "key": "Access-Control-Allow-Methods", "value": "GET, POST, PUT, DELETE, OPTIONS" }
      ]
    }
  ],
  "rewrites": [
    {
      "source": "/widget/v1/:path*",
      "destination": "https://cdn.buzzi.ai/widget/v1/:path*"
    }
  ]
}
```

**Environment Variables:**
```bash
# Production environment
DATABASE_URL=
DIRECT_URL=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
REDIS_URL=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

### 25.8 Database Migration Strategy

**Migration Scripts:**
```bash
# Run migrations
pnpm db:migrate

# Generate migration
pnpm db:generate

# Push schema (development)
pnpm db:push
```

**Drizzle Migration Configuration:**
```typescript
// drizzle.config.ts
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/lib/db/schema.ts',
  out: './drizzle/migrations',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.DATABASE_URL!,
  },
} satisfies Config;
```

### 25.9 Monitoring & Observability

**Sentry Configuration:**
```typescript
// sentry.client.config.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  integrations: [
    new Sentry.Replay(),
    new Sentry.BrowserTracing(),
  ],
});
```

**Application Metrics:**
```typescript
// src/lib/metrics.ts
import { Counter, Histogram } from 'prom-client';

export const metrics = {
  httpRequestDuration: new Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.1, 0.5, 1, 2, 5],
  }),

  agentExecutionDuration: new Histogram({
    name: 'agent_execution_duration_seconds',
    help: 'Duration of agent message processing',
    labelNames: ['agent_id', 'company_id'],
  }),

  messagesProcessed: new Counter({
    name: 'messages_processed_total',
    help: 'Total number of messages processed',
    labelNames: ['channel', 'status'],
  }),

  activeConversations: new Counter({
    name: 'active_conversations_total',
    help: 'Number of active conversations',
    labelNames: ['company_id', 'agent_id'],
  }),
};
```

**Logging Configuration:**
```typescript
// src/lib/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: process.env.NODE_ENV !== 'production',
    },
  },
  formatters: {
    level: (label) => ({ level: label }),
  },
  base: {
    env: process.env.NODE_ENV,
    version: process.env.npm_package_version,
  },
});
```

### 25.10 Health Checks

**Health Check Endpoint:**
```typescript
// src/app/api/health/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { redis } from '@/lib/redis';

export async function GET() {
  const checks = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: 'unknown',
      redis: 'unknown',
      openai: 'unknown',
    },
  };

  // Check database
  try {
    await db.execute('SELECT 1');
    checks.services.database = 'healthy';
  } catch (error) {
    checks.services.database = 'unhealthy';
    checks.status = 'degraded';
  }

  // Check Redis
  try {
    await redis.ping();
    checks.services.redis = 'healthy';
  } catch (error) {
    checks.services.redis = 'unhealthy';
    checks.status = 'degraded';
  }

  const statusCode = checks.status === 'healthy' ? 200 : 503;
  return NextResponse.json(checks, { status: statusCode });
}
```

### 25.11 Performance Optimization

**Bundle Analysis:**
```bash
# Analyze bundle size
ANALYZE=true pnpm build
```

**Next.js Optimization:**
```typescript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizePackageImports: ['lucide-react', '@heroui/react'],
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
  headers: async () => [
    {
      source: '/:path*',
      headers: [
        { key: 'X-DNS-Prefetch-Control', value: 'on' },
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      ],
    },
  ],
};

module.exports = nextConfig;
```

### 25.12 Security Checklist

**Pre-deployment Security Review:**
- [ ] All environment variables stored securely
- [ ] API keys rotated from development
- [ ] CORS configured correctly
- [ ] Rate limiting enabled on all API routes
- [ ] Input validation on all forms
- [ ] SQL injection prevention verified
- [ ] XSS prevention verified
- [ ] CSRF protection enabled
- [ ] Webhook signatures validated
- [ ] File upload validation enabled
- [ ] Domain allowlisting for widget
- [ ] Authentication tokens have appropriate expiry
- [ ] Sensitive data encrypted at rest
- [ ] SSL/TLS enforced

---

## Deployment Checklist

### Pre-deployment
- [ ] All tests passing (unit, integration, E2E)
- [ ] TypeScript compilation successful
- [ ] Linting errors resolved
- [ ] Database migrations ready
- [ ] Environment variables configured
- [ ] Domain configured in DNS
- [ ] SSL certificates provisioned

### Deployment Steps
1. Run database migrations
2. Deploy application to staging
3. Run smoke tests on staging
4. Deploy to production
5. Verify health checks
6. Monitor error rates

### Post-deployment
- [ ] Health checks passing
- [ ] Error monitoring active
- [ ] Performance metrics normal
- [ ] User acceptance testing complete
- [ ] Documentation updated

---

## File Structure

```
__tests__/
├── unit/
│   ├── lib/
│   │   └── utils.test.ts
│   ├── hooks/
│   │   └── useAuth.test.ts
│   └── components/
│       └── Button.test.tsx
├── integration/
│   ├── api/
│   │   ├── agents.test.ts
│   │   └── conversations.test.ts
│   └── db/
│       └── agents.test.ts
├── e2e/
│   ├── auth.spec.ts
│   ├── agents.spec.ts
│   ├── conversations.spec.ts
│   └── widget.spec.ts
├── factories/
│   ├── user.ts
│   ├── agent.ts
│   └── conversation.ts
└── helpers/
    ├── database.ts
    └── auth.ts

.github/
└── workflows/
    ├── ci.yml
    └── deploy.yml

drizzle/
└── migrations/
    └── 0001_initial.sql
```

---

## Validation Checklist

- [ ] Unit tests have >80% code coverage
- [ ] Integration tests cover all API routes
- [ ] E2E tests cover critical user journeys
- [ ] CI pipeline passes on all branches
- [ ] Staging deployment successful
- [ ] Production deployment successful
- [ ] Health checks passing
- [ ] Error monitoring configured
- [ ] Performance monitoring configured
- [ ] Alerts configured for critical issues

---

## Related Documentation
- [Step 01 - Project Setup](./step-01-project-setup.md)
- [Architecture Overview](../architecture-overview.md)
