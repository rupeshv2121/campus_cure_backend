# CC-14: Structured complaint intake

| | |
|---|---|
| **Status** | **Shipped 2026-09-20 — complete** |
| **Phase** | 1 |
| **Branch** | `feat/CC-14-complaint-intake` |
| **Repos** | both |
| **Depends on** | CC-01 |
| **Blocks** | nothing |
| **Estimate** | 4 days |
| **Shipped** | 2026-09-20 |

## Problem

Filing a complaint currently means a dropdown for `category`, a dropdown for `block`, a dropdown for
`classroomNumber`, a number for `priority`, plus a title and description. Six fields for "the
projector in ML03 is dead".

The original roadmap called this "AI complaint routing: predict the department". **That framing was
wrong and is deliberately not what this spec builds.** The form already collects `category` from a
dropdown, so a model predicting it would be recovering a value the student had just supplied — an
impressive-looking pipeline doing no work. Anyone who knows ML would notice.

The real friction is the opposite: the student knows what is broken and where, and has to translate
that into six form controls.

## Goal

A student types what is wrong in plain language. The system extracts category, location and priority,
shows them for confirmation, and the student submits.

The AI does genuine work here — turning unstructured text into structured fields — because those
fields are not otherwise supplied.

## Non-goals / Out of scope

- **Auto-assigning the complaint to a person.** The deleted `autoRouting.js` mapped categories to
  *teaching faculty* by department, which routed a broken fan to an Electrical Engineering lecturer.
  Fans are fixed by electricians. Routing to the right *person* needs non-teaching staff as
  first-class targets — that is **CC-27**, which does not exist yet. This spec determines the
  category; assignment stays with the admin.
- Submitting without review. The extraction is a suggestion the student confirms, never a silent
  categorisation.
- Removing the existing form. It stays as the fallback and for correction.
- Free-text location invention. A room the model has not been given is not a room.

## Design

### Rules first, model second

A keyword rules table maps text to a category deterministically. It runs first, costs nothing, and is
reproducible. The model is called **only when the rules do not match**.

This is not a performance optimisation — it is the honest architecture. Most complaints say "fan",
"light", "projector" or "wifi" outright, and a regex is the correct tool for that. Reaching for an
LLM where `includes("projector")` suffices is the thing that makes AI projects look unserious.

It also produces a real comparison: rules-only, model-only, and rules-then-model can all be measured
against the same labelled set. **If rules beat the model, that is the result and it gets reported.**

### Location is never invented

`block` and `classroomNumber` are matched against the known list from `block_classroom.json`. The
model is given that list and its output is validated against it; anything not on the list is dropped
rather than passed through. A hallucinated room number would route a real fault to a room that does
not exist.

### Priority

**1 (Low) to 5 (Critical)**, matching the form the student already sees and the values already in the
database. Inferred from the text — "cannot take the lecture" is Critical, "a bit scratched" is Low.

The direction was wrong in the first implementation and is worth stating explicitly, because it is
easy to get backwards and silent when you do: an inverted scale files "sparking socket, dangerous"
as **Low**. A test pins it.

Today `priority` is student-supplied, which means everything is urgent; an inferred default the
student can override is more useful than a field nobody thinks about.

### Endpoint

`POST /api/students/complaints/parse` — `{ text }` → `{ category, priority, block, classroomNumber,
source, confidence }`.

- `source` is `"rules"` or `"model"`, so the UI and the evaluation can tell which answered.
- Nothing is written. Parsing is a read-only helper; the existing create endpoint is unchanged.
- Rate limited, and short-circuited below a minimum length.

### Degradation

Extraction failing is not an error: the student still has the full form. With `AI_ENABLED=false`, no
provider, or a provider outage, the rules still run and whatever they find is returned.

## Acceptance criteria

1. Free text mentioning a known category resolves to it **without any model call**.
2. Text the rules cannot classify falls through to the model.
3. A block and room mentioned in the text are extracted and **validated against the known list**.
4. A room not on the known list is dropped, never returned.
5. Priority is inferred and is one of 1–5, in the same direction as the form (1 Low, 5 Critical).
6. `source` reports correctly which path answered.
7. Nothing is written to the database by parsing.
8. With `AI_ENABLED=false`, rules still work and the endpoint still answers.
9. A provider outage returns the rules result rather than an error.
10. Only students may call it; it is rate limited.
11. The extraction is presented for confirmation — the frontend never auto-submits.
12. Accuracy is measured for rules-only, model-only and hybrid on a labelled set, and reported.

## Test plan

- **Unit:** the rules table across every category; location validation rejecting unknown rooms;
  priority bounds; defensive parsing of malformed model JSON.
- **Integration (mocked):** model called only on rules miss; degradation paths; authz.
- **Evaluation:** labelled complaint texts, accuracy for all three configurations.

## Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Model invents a room number | Medium | **High** | Output validated against the known list; unknown values dropped |
| Silent mis-categorisation | Medium | **High** | Always presented for confirmation; never auto-submitted |
| Model called for cases a regex handles | **High** | Medium | Rules run first; measured, and the model is skipped entirely on a hit |
| Rules beat the model, making the AI look pointless | Medium | Low | Then that is the finding, and it gets reported. The value is the extraction of *location and priority*, which rules do poorly |
| Free-tier quota consumed by parsing | Medium | Medium | Rules-first means most requests cost nothing; rate limited; minimum length |

## Rollback

Additive: one new endpoint, one new service, no schema change. The existing complaint form is
untouched and remains fully usable.

## Open questions

- Should a low-confidence extraction be suppressed entirely rather than shown? Measure the confusion
  first — a wrong suggestion the student corrects is cheaper than no suggestion at all, but only if
  it is obviously editable.
- Should the rules table be data rather than code, so an admin can extend it? Only once someone asks.


---

## Results

Measured on 20 labelled complaints (`npx tsx src/scripts/evalIntake.ts`):

| config | accuracy |
|---|---|
| rules only | 55.0% |
| **model only** | **95.0%** |
| hybrid (shipped default) | 85.0% |
| hybrid with `INTAKE_PREFER_MODEL=true` | 95.0% |

By case type:

| kind | n | rules | model | hybrid |
|---|---|---|---|---|
| keyword | 8 | 100% | 100% | 100% |
| implicit | 6 | **0%** | 100% | 100% |
| other | 3 | 100% | 100% | 100% |
| **trap** | 3 | 0% | 66.7% | **0%** |

Room extraction: **100% exact match**. The model was called for 9 of 20 cases; the rest were answered
by rules at no cost.

### The finding, stated plainly

**Model-only beats the shipped hybrid by 10 points, and the entire gap is the trap cases.**

Rules-first means a rules *false positive* never reaches the model — "a wasp nest outside the
**window**" is classified as FURNITURE and nothing corrects it. That is the real cost of the design,
and the fixtures were written specifically to measure it rather than let it hide.

Rules-first still ships as the default:

- it answered **55% of cases at zero cost and zero latency**, which matters on a free tier;
- the student confirms every suggestion, so a wrong one is corrected rather than filed;
- traps are 15% of this deliberately adversarial set and rarer in real complaints.

`INTAKE_PREFER_MODEL=true` buys the 10 points back for 20/20 model calls. The lever is measured and
documented rather than assumed.

The implicit row is the case for the feature at all: **rules score 0% where the fault is described
rather than named** ("the thing on the ceiling has stopped spinning"), and the model scores 100%.

## Delivery log

### Shipped 2026-09-20 — branch `feat/CC-14-complaint-intake`

249 tests passing (31 new). Verified live end to end.

### Found during implementation

1. **Priority was inverted.** The form the student sees is `1 Low … 5 Critical` and the database
   already holds values across that range, but the extractor was written `1 = urgent`. It would have
   filed "sparking socket, dangerous" as **Low**. Caught by reading the existing form options rather
   than assuming the scale. Fixed in the rules, the model prompt and the seeder; a test now pins the
   direction.
2. **Room extraction missed spaced and hyphenated codes.** "ML 05" and "ML-07" failed because the
   pattern was built per known room. Rewritten to find room-shaped tokens and validate them against
   the known list, so validation lives in one place.
3. **A template literal ate a word boundary.** ``new RegExp(`${block}...`)`` written with a single
   backslash is a *backspace character*, not ``, so "NL Block" never matched.

### Not done

- **Auto-assignment to a person.** Deliberately out of scope: routing a broken fan to the right
  person needs non-teaching staff as first-class targets, which is CC-27. This determines the
  category; assignment stays with the admin.
