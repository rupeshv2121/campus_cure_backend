/**
 * CC-12 criterion 4: no student-facing code may read AnswerDraft.
 *
 * A structural test rather than a behavioural one. Behavioural tests can only
 * check the endpoints that exist today; this fails the moment anyone adds a
 * student query against the draft table, which is the mistake that would leak
 * unreviewed AI content to students.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("AnswerDraft isolation", () => {
  it("is never referenced by the student controller", () => {
    const source = read("../../controllers/studentController.ts");
    expect(source).not.toMatch(/answerDraft/i);
  });

  it("is never referenced by the admin controller", () => {
    const source = read("../../controllers/adminController.ts");
    expect(source).not.toMatch(/answerDraft/i);
  });

  it("is referenced by the faculty controller, which owns review", () => {
    const source = read("../../controllers/facultyController.ts");
    expect(source).toMatch(/answerDraft/i);
  });

  it("exposes draft routes only under /api/faculty", () => {
    for (const file of ["students.ts", "admin.ts"]) {
      expect(read(`../../routes/${file}`)).not.toMatch(/draft/i);
    }
    expect(read("../../routes/faculty.ts")).toMatch(/draft/i);
  });
});
