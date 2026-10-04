/**
 * CC-12 criterion 4: no student-facing code may read AnswerDraft.
 *
 * A structural test rather than a behavioural one. Behavioural tests can only
 * check the endpoints that exist today; this fails the moment anyone adds a
 * student query against the draft table, which is the mistake that would leak
 * unreviewed AI content to students.
 */
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

/**
 * A controller's whole source: the index file plus every module in its
 * directory. CC-72 split each controller into ./<area>/*.ts and left the old
 * file as re-exports - reading only that file would make the "never
 * referenced" checks below pass vacuously.
 */
const readController = (name: "student" | "admin" | "faculty") => {
  const dir = new URL(`../../controllers/${name}/`, import.meta.url);
  const modules = readdirSync(dir)
    .filter((file) => file.endsWith(".ts"))
    .map((file) => readFileSync(new URL(file, dir), "utf8"));
  expect(modules.length, `${name} controller modules`).toBeGreaterThan(0);
  return [read(`../../controllers/${name}Controller.ts`), ...modules].join("\n");
};

describe("AnswerDraft isolation", () => {
  it("is never referenced by the student controller", () => {
    const source = readController("student");
    expect(source).not.toMatch(/answerDraft/i);
  });

  it("is never referenced by the admin controller", () => {
    const source = readController("admin");
    expect(source).not.toMatch(/answerDraft/i);
  });

  it("is referenced by the faculty controller, which owns review", () => {
    const source = readController("faculty");
    expect(source).toMatch(/answerDraft/i);
  });

  it("exposes draft routes only under /api/faculty", () => {
    for (const file of ["students.ts", "admin.ts"]) {
      expect(read(`../../routes/${file}`)).not.toMatch(/draft/i);
    }
    expect(read("../../routes/faculty.ts")).toMatch(/draft/i);
  });
});
