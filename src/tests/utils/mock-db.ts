/**
 * Database Mocks
 *
 * Mock implementations for database queries and mutations.
 */

import { vi } from "vitest";

// ============================================================================
// Mock Database
// ============================================================================

export const mockDb = {
  query: {
    users: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    companies: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    agents: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    conversations: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    messages: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    knowledgeSources: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    knowledgeChunks: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    escalations: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    plans: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    packages: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    auditLogs: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
  select: vi.fn(() => mockDb),
  from: vi.fn(() => mockDb),
  where: vi.fn(() => mockDb),
  insert: vi.fn(() => mockDb),
  values: vi.fn(() => mockDb),
  update: vi.fn(() => mockDb),
  set: vi.fn(() => mockDb),
  delete: vi.fn(() => mockDb),
  returning: vi.fn(() => Promise.resolve([])),
  execute: vi.fn(() => Promise.resolve([])),
  leftJoin: vi.fn(() => mockDb),
  innerJoin: vi.fn(() => mockDb),
  orderBy: vi.fn(() => mockDb),
  limit: vi.fn(() => mockDb),
  offset: vi.fn(() => mockDb),
  groupBy: vi.fn(() => mockDb),
};

// ============================================================================
// Database Mock Helper
// ============================================================================

export function setupDbMock() {
  vi.mock("@/lib/db", () => ({
    db: mockDb,
  }));
}

export function resetDbMock() {
  Object.values(mockDb.query).forEach((table) => {
    Object.values(table).forEach((fn) => {
      if (typeof fn === "function" && "mockReset" in fn) {
        (fn as ReturnType<typeof vi.fn>).mockReset();
      }
    });
  });

  mockDb.select.mockReset().mockReturnValue(mockDb);
  mockDb.from.mockReset().mockReturnValue(mockDb);
  mockDb.where.mockReset().mockReturnValue(mockDb);
  mockDb.insert.mockReset().mockReturnValue(mockDb);
  mockDb.values.mockReset().mockReturnValue(mockDb);
  mockDb.update.mockReset().mockReturnValue(mockDb);
  mockDb.set.mockReset().mockReturnValue(mockDb);
  mockDb.delete.mockReset().mockReturnValue(mockDb);
  mockDb.returning.mockReset().mockResolvedValue([]);
  mockDb.execute.mockReset().mockResolvedValue([]);
}

// ============================================================================
// Drizzle Operators Mock
// ============================================================================

export const mockEq = vi.fn((a, b) => ({ type: "eq", a, b }));
export const mockAnd = vi.fn((...args) => ({ type: "and", args }));
export const mockOr = vi.fn((...args) => ({ type: "or", args }));
export const mockNe = vi.fn((a, b) => ({ type: "ne", a, b }));
export const mockGt = vi.fn((a, b) => ({ type: "gt", a, b }));
export const mockGte = vi.fn((a, b) => ({ type: "gte", a, b }));
export const mockLt = vi.fn((a, b) => ({ type: "lt", a, b }));
export const mockLte = vi.fn((a, b) => ({ type: "lte", a, b }));
export const mockLike = vi.fn((a, b) => ({ type: "like", a, b }));
export const mockIlike = vi.fn((a, b) => ({ type: "ilike", a, b }));
export const mockInArray = vi.fn((a, b) => ({ type: "inArray", a, b }));
export const mockIsNull = vi.fn((a) => ({ type: "isNull", a }));
export const mockIsNotNull = vi.fn((a) => ({ type: "isNotNull", a }));
export const mockDesc = vi.fn((a) => ({ type: "desc", a }));
export const mockAsc = vi.fn((a) => ({ type: "asc", a }));

export function setupDrizzleOperatorsMock() {
  vi.mock("drizzle-orm", () => ({
    eq: mockEq,
    and: mockAnd,
    or: mockOr,
    ne: mockNe,
    gt: mockGt,
    gte: mockGte,
    lt: mockLt,
    lte: mockLte,
    like: mockLike,
    ilike: mockIlike,
    inArray: mockInArray,
    isNull: mockIsNull,
    isNotNull: mockIsNotNull,
    desc: mockDesc,
    asc: mockAsc,
    sql: vi.fn((strings, ...values) => ({ strings, values })),
  }));
}
