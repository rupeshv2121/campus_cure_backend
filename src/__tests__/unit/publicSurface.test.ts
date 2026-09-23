/**
 * What the API exposes without a token (2026-09-23).
 *
 * Two real defects found by auditing the unauthenticated surface, both fixed,
 * both pinned here so they cannot come back quietly.
 *
 * These are deliberately *textual* checks against the route and app sources,
 * in the style of `draftIsolation.test.ts`. A behavioural test would need a
 * live database; the property being defended — "this route does not exist" and
 * "this handler does not return the raw error" — is visible in the source and
 * is exactly what a careless re-add would change.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const read = (relative: string): string =>
  readFileSync(resolve(here, relative), "utf8");

/**
 * Defect 1: three unauthenticated `POST /` profile-creation routes.
 *
 * `authController.register` already creates the matching profile for every
 * role, so these were dead code the frontend never called. But they were
 * unauthenticated, took `userId` from the request body, and wrote permission
 * fields (`adminLevel`, `manageUsers`, `assignedDepartments`) straight from
 * that body.
 *
 * Registration creates the user and the profile in two separate awaited steps
 * rather than one transaction. A failure between them leaves a PENDING
 * privileged user with no profile — precisely the state in which the "profile
 * already exists" guard stops guarding and an anonymous caller gets to choose
 * that admin's permissions.
 */
describe("profile creation is not exposed anonymously", () => {
  it.each([
    ["admin.ts", "createAdminProfile"],
    ["faculty.ts", "createFacultyProfile"],
    ["students.ts", "createStudentProfile"],
  ])("%s no longer mounts %s", (file, handler) => {
    const source = read(`../../routes/${file}`);

    expect(source).not.toMatch(new RegExp(`router\\.post\\(\\s*"/"\\s*,\\s*${handler}`));
    // Nor re-added under any path without an auth guard.
    expect(source).not.toMatch(new RegExp(`${handler}\\s*\\)`));
  });

  /**
   * The general rule the above is one instance of: no route module may mount a
   * bare `POST "/"` without authentication. Written as a rule rather than three
   * cases so a fourth role added later is covered on day one.
   */
  it.each(["admin.ts", "faculty.ts", "students.ts"])(
    "%s mounts no unauthenticated root POST",
    (file) => {
      const source = read(`../../routes/${file}`);
      const rootPosts = source.match(/router\.post\(\s*"\/"\s*,[^;]*;/g) ?? [];

      for (const route of rootPosts) {
        expect(route).toMatch(/authenticate/);
      }
    },
  );
});

/**
 * Defect 2: `/keep-db-alive` returned `err.message` to the caller.
 *
 * A Prisma failure message is not a short string. Verified against a
 * deliberately bad DATABASE_URL, the response body contained:
 *
 *   - the database HOST  ("Can't reach database server at <host>")
 *   - the absolute path of the file that made the call
 *   - an excerpt of the surrounding SOURCE CODE
 *
 * The route is unauthenticated and sits outside `/api`, so that was served to
 * anyone who asked. The detail now goes to the logs and the caller gets the
 * health verdict it asked for.
 */
describe("keep-db-alive leaks nothing", () => {
  const source = read("../../app.ts");

  it("does not return the raw error to the caller", () => {
    expect(source).not.toMatch(/err\?\.message/);
    expect(source).not.toMatch(/error:\s*err/);
  });

  it("answers 503 with a fixed body", () => {
    expect(source).toMatch(/status\(503\)\.json\(\{\s*status:\s*"DB unavailable"/);
  });

  it("still records the detail where it is useful", () => {
    expect(source).toMatch(/logger\.error\("keep-db-alive failed"/);
  });
});

/**
 * The error handler is identified by Express through its arity. Deleting the
 * unused fourth parameter silently turns it back into ordinary middleware and
 * every unhandled error goes back to Express's HTML default — including, off
 * production, the stack trace. Cheap to pin, expensive to discover.
 */
describe("the error handler stays an error handler", () => {
  it("keeps four parameters", () => {
    const source = read("../../middleware/observability.ts");
    expect(source).toMatch(/_next:\s*NextFunction/);
  });

  it("is mounted last, after the 404 handler", () => {
    const source = read("../../app.ts");
    expect(source.indexOf("app.use(notFoundHandler)")).toBeGreaterThan(
      source.indexOf("app.use(routes)"),
    );
    expect(source.indexOf("app.use(errorHandler)")).toBeGreaterThan(
      source.indexOf("app.use(notFoundHandler)"),
    );
  });
});
