/**
 * A stand-in for the Prisma client.
 *
 * Tier 1 tests assert *authorization* — which role may reach which route. That
 * decision is made by middleware before any query runs, so the tests need a
 * client that answers plausibly and never touches a database.
 *
 * `user.findUnique` is special-cased because `middleware/auth.ts` calls it on
 * every authenticated request to confirm the account still exists and is active.
 * Everything else returns an empty-ish default so handlers past the guard fail
 * gracefully instead of exploding.
 */
import { vi } from "vitest";

export interface MockUser {
  id: string;
  role: string;
  userID: string;
  university: string;
  isActive: boolean;
  approvalStatus?: string;
  email?: string;
  password?: string;
}

let currentUser: MockUser | null = null;

/** Set the account that `authenticate` will resolve for the next request. */
export const setMockUser = (user: MockUser | null): void => {
  currentUser = user;
};

/** Set the account `login` will find by email, or null for "no such user". */
let loginUser: MockUser | null = null;
export const setLoginUser = (user: MockUser | null): void => {
  loginUser = user;
};

export const resetMockState = (): void => {
  currentUser = null;
  loginUser = null;
};

const emptyModel = () => ({
  findMany: vi.fn(async () => [] as unknown[]),
  findUnique: vi.fn(async () => null),
  findFirst: vi.fn(async () => null),
  create: vi.fn(async () => ({})),
  createMany: vi.fn(async () => ({ count: 0 })),
  update: vi.fn(async () => ({})),
  updateMany: vi.fn(async () => ({ count: 0 })),
  upsert: vi.fn(async () => ({})),
  delete: vi.fn(async () => ({})),
  deleteMany: vi.fn(async () => ({ count: 0 })),
  count: vi.fn(async () => 0),
  aggregate: vi.fn(async () => ({})),
  groupBy: vi.fn(async () => [] as unknown[]),
});

const userModel = {
  ...emptyModel(),
  /**
   * Serves two callers:
   *  - authenticate() looks the caller up by id on every request
   *  - login() looks the account up by email
   */
  findUnique: vi.fn(
    async (args: { where?: { id?: string; email?: string } }) => {
      const where = args?.where;
      if (where?.id) {
        return currentUser && where.id === currentUser.id ? currentUser : null;
      }
      if (where?.email) {
        return loginUser && where.email === loginUser.email ? loginUser : null;
      }
      return null;
    },
  ),
  /** register() checks for an existing account by email OR userID. */
  findFirst: vi.fn(async () => loginUser),
  /** register() creates the account; echo back something id-shaped. */
  create: vi.fn(async (args: { data?: Record<string, unknown> }) => ({
    id: "created-user-id",
    university: "UNSPECIFIED",
    approvalStatus: "PENDING",
    ...(args?.data ?? {}),
  })),
};

const models = new Map<string, ReturnType<typeof emptyModel>>([
  ["user", userModel as unknown as ReturnType<typeof emptyModel>],
]);

/**
 * Proxy so any model the app touches resolves to a usable stub without this
 * file having to enumerate the whole schema — which would otherwise need
 * updating every time a model is added.
 */
export const prismaMock = new Proxy(
  {},
  {
    get(_target, prop: string) {
      if (prop === "$connect" || prop === "$disconnect") {
        return vi.fn(async () => undefined);
      }
      if (prop === "$transaction") {
        return vi.fn(async (arg: unknown) =>
          typeof arg === "function"
            ? (arg as (c: unknown) => unknown)(prismaMock)
            : arg,
        );
      }
      if (prop === "$queryRaw" || prop === "$executeRaw") {
        return vi.fn(async () => []);
      }
      if (prop === "then") {
        // Stops the proxy being mistaken for a thenable when awaited.
        return undefined;
      }
      if (!models.has(prop)) {
        models.set(prop, emptyModel());
      }
      return models.get(prop);
    },
  },
) as Record<string, ReturnType<typeof emptyModel>>;
