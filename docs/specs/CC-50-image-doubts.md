# CC-50: Image-based doubt submission

| | |
|---|---|
| **Status** | **Implemented** 2026-09-23 — code complete and tested; blocked on Mistral quota for a live demo |
| **Phase** | 5 |
| **Branch** | `feat/CC-50-image-doubts` |
| **Repos** | both |
| **Depends on** | CC-02 (bucket live 2026-09-22), CC-10 |
| **Blocks** | nothing |
| **Estimate** | 3 days |
| **Shipped** | — |

## Problem

A student stuck on a handwritten problem set, a textbook question or a circuit diagram has to
*retype* it to ask about it. Subscripts, integrals, matrices and circuit topology are all hostile to
a plain textarea, and the friction is highest exactly when the student is most stuck.

The image can already be attached — CC-24 shipped doubt attachments — but an attached photo is
inert. It is not searchable, not embeddable (CC-10 indexes text), and a faculty member scanning a
list of doubts sees a title of "help pls" with a JPEG behind it.

## Goal

A student uploads a photo of a question. A vision model reads it and fills in the title,
description, subject and tags. The student checks it, edits anything wrong, and posts through the
normal form. The original image stays attached.

## Non-goals / Out of scope

- **Answering the question.** The model transcribes only. This is enforced in the prompt and
  asserted in a test, because an unconstrained vision model happily solves the equation it just
  read — and a doubt whose description contains its own answer defeats the point of asking.
- **Auto-posting.** Nothing here writes a doubt. See *Why it never posts* below.
- **PDFs.** "Upload your PDF and we will read page one" is a different feature with different
  failure modes.
- **Handwriting *recognition* as a measurable claim.** We report what the model returned; we do not
  claim an accuracy figure. See *The evaluation gap*.
- **Re-transcribing on edit.** One image, one read, triggered by the student.

## Design

### Why vision, not OCR

The original roadmap had a Tesseract OCR phase. Classical OCR is the wrong tool twice over:

1. It fails badly on handwriting, which is the main input here.
2. It emits a character stream, so it *structurally cannot* represent a diagram or a formula. A
   circuit sketch becomes noise; an integral sign becomes `f`.

A vision model reads the handwriting **and** understands the question in one call. Fewer moving
parts, better accuracy, and it handles the diagram case OCR cannot. The original image stays
attached regardless, so a reader can always check the transcription against what was written.

### Why it never posts

Auto-posting would publish text the student has not read, under their name, to a community that
upvotes it and builds reputation from it (CC-25). A transcription can be *confidently* wrong in a
way typed text cannot — a misread exponent gives a question that is answerable but not the one that
was asked — and the student is the only person who can catch that.

So the endpoint returns fields, the form fills in, and the student submits. Identical posture to
CC-14, for identical reasons.

### Flow

```
  browser                          backend                         Mistral
     |  (CC-02) upload image          |                               |
     |------------------------------->|                               |
     |  attachmentId                  |                               |
     |                                |                               |
     |  POST /students/doubts/from-image                              |
     |------------------------------->|  own? DOUBT? mime? size?      |
     |                                |  download bytes from bucket   |
     |                                |  inline as base64 ----------->|
     |                                |<---------- JSON transcription |
     |  { title, description, ... }   |  parse, normalise, validate   |
     |<-------------------------------|                               |
     |                                |                               |
     |  student edits, then POST /students/doubts (normal path)       |
```

### Why the bytes come through the server

The image is inlined as base64 rather than passed to Mistral as a signed Supabase URL. A signed URL
is smaller on the wire, but it hands a third party a live credential to a private bucket — and the
bucket is private (CC-02) precisely because doubt and complaint photos can identify people. Paying
~33% base64 overhead to keep the bytes inside a request we control is the right side of that trade.

This is the only read path in the codebase that pulls object bytes through the server, which is why
`downloadObject` is new and why `VISION_MAX_IMAGE_BYTES` is checked *before* the download.

### The MIME allow-list disagrees with CC-02, on purpose

| | CC-02 storage | CC-50 vision |
|---|---|---|
| `image/jpeg`, `image/png`, `image/webp` | accept | accept |
| `image/heic` | accept | **reject** |
| `application/pdf` | accept | **reject** |

HEIC is the iPhone camera default, so CC-02 must accept it or silently reject a large share of the
student body's photos. Mistral rejects it. This is the one place the two allow-lists differ, so the
error message names the formats that work rather than saying "unsupported".

### Schema

Two additive columns on `Doubt`:

```prisma
transcribedFromImage Boolean @default(false)
transcriptionModel   String?
```

The transcription itself goes in the existing `description`, because an image-derived doubt **is** a
doubt: it must be searchable (CC-11), embeddable (CC-10), answerable and moderatable through exactly
the same paths. A separate table would have forced every read path to branch.

`transcribedFromImage` is **not cleared when the student edits**. We explicitly ask them to check
every number, so editing is the expected path — clearing on edit would mean the flag is almost never
set, which is the opposite of what it is for. It records where the text came from, not who touched
it last.

Migration: `20260923100000_cc50_add_doubt_transcription`.

### New modules

| File | Responsibility |
|---|---|
| `src/services/ai/vision/types.ts` | Provider contract, error types |
| `src/services/ai/vision/mistralVision.ts` | The only module that speaks to the vision API |
| `src/services/ai/vision/index.ts` | Provider selection and availability |
| `src/services/vision/extractDoubt.ts` | Validation, prompt, parsing. No HTTP |
| `src/services/storage/supabaseStorage.ts` | `downloadObject` added |

### Endpoint

**`POST /api/students/doubts/from-image`** — students only, `chatLimiter`.

```jsonc
// request
{ "attachmentId": "uuid" }
// 200
{ "title": "...", "description": "...", "subject": "Mathematics",
  "labels": ["algebra"], "legible": true,
  "model": "mistral-medium-latest", "provider": "mistral-vision" }
```

Statuses are distinct on purpose, and the frontend surfaces the server's message verbatim. They are
the difference between *try a clearer photo* and *this deployment cannot read images at all*:

| Status | Meaning |
|---|---|
| 400 | Wrong format, too large, not a doubt attachment, or the upload never landed |
| 403 | Not the uploader — stricter than the read rule, because extraction costs quota |
| 404 | No such attachment |
| 422 | Image unreadable, or contains no question |
| 503 | Vision unavailable, provider failed, or reply unparseable |

Metered by `chatLimiter` (10/min) rather than `uploadLimiter`: the expensive part is the completion,
not the upload before it.

## Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Single provider** — Mistral is the only vision model on our keys | **High** | **High** | Feature degrades to "type it yourself"; `VISION_ENABLED` is its own switch so chat/search/drafts are unaffected. See below |
| Model answers instead of transcribing | Medium | High | Forbidden in the prompt; asserted in a test |
| Confident hallucination on a blurred photo | Medium | High | `legible` flag; empty description overrides a `legible: true` claim; original image stays attached; UI warns |
| Quota exhausted by one student re-reading | Medium | Medium | `chatLimiter`, 10/min per user |
| Image too large for the lambda | Low | Medium | `VISION_MAX_IMAGE_BYTES` checked before download |
| Signed URL leaked to a third party | — | — | Avoided structurally: bytes are inlined, never a URL |

### The single-provider risk is real and was measured

Checked live on 2026-09-23:

- **Groq** catalogue on our key is text-only — `gpt-oss`, `qwen`, `whisper`, prompt-guard. No
  multimodal model, so there is nothing to fail over to.
- **Mistral** `mistral-medium-latest` reports vision support. Pixtral, which the roadmap named, no
  longer appears in the catalogue at all.

Generation (CC-12, CC-15) fails over between Groq and Mistral because one fluent paragraph
substitutes for another. Vision cannot. CC-50 is therefore the one AI feature in CampusCure with a
single point of failure, and that is recorded rather than hidden.

## Acceptance criteria

**Status 2026-09-23:** 10 of 13 covered by automated tests (38 assertions across
`imageDoubts.test.ts` and `mistralVision.test.ts`, plus one row in the authz matrix). Criteria 1, 2
and 13 need a working Mistral quota — see *Blocked on quota*.

1. A student uploads a photo of a handwritten question and the form fills in.
2. The posted doubt is searchable by CC-11 and has an embedding.
3. `POST /doubts/from-image` returns 401 unauthenticated, 403 for non-students.
4. Another student's attachment returns 403 and spends no quota.
5. A COMPLAINT attachment returns 400.
6. HEIC and PDF return 400 naming the supported formats, before any download.
7. An image over `VISION_MAX_IMAGE_BYTES` returns 400 before any download.
8. An illegible image returns 422, not a fabricated question.
9. A reply claiming `legible: true` with an empty description is treated as illegible.
10. Unparseable model output returns 503, never a half-filled form.
11. With `VISION_ENABLED=false` the endpoint returns 503 without querying the database.
12. Labels from an image normalise identically to typed tags (CC-20).
13. A posted image doubt shows the transcription notice, and the original image is viewable.

## Test plan

- **Unit:** the parser against fenced JSON, prose-wrapped JSON, malformed JSON, missing `legible`,
  empty-but-legible, over-long tags, duplicate tags, over-long titles. The extractor against every
  rejection path with a mocked Supabase and a mocked provider. The provider against its retry ladder
  with injected `fetch` and `sleep` — nothing touches the network.
- **Integration:** one row in `src/__tests__/authz/matrix.test.ts`.
- **Manual (blocked):** photograph a real handwritten question in poor light; confirm the
  transcription, confirm a deliberately blurred photo returns 422 rather than a plausible invention.

## Blocked on quota

The code is complete and the suite is green, but the feature **cannot be demonstrated** right now.
As of 2026-09-23 the Mistral API key returns `429 Rate limit exceeded` on every
`/chat/completions` call, for both `mistral-small-latest` and `mistral-medium-latest`, while
`/v1/models` returns 200. The key is valid; the account has no usable inference quota.

This is not a CC-50 bug and it does not affect anything else: Groq is the primary generation
provider, so CC-12 and CC-15 are healthy. But it does mean:

- No live demo of image doubts until the Mistral account is activated or topped up.
- **CC-12 and CC-15 currently have no working fallback.** If Groq goes down, generation stops
  entirely rather than degrading. That is a pre-existing condition this spec surfaced, not one it
  introduced.

Resolution is an account action, not a code change: activate billing on the Mistral account, or
point `MISTRAL_API_KEY` at one with quota. Verify with:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://api.mistral.ai/v1/chat/completions \
  -H "Authorization: Bearer $MISTRAL_API_KEY" -H "Content-Type: application/json" \
  -d '{"model":"mistral-medium-latest","messages":[{"role":"user","content":"hi"}],"max_tokens":5}'
```

`200` means CC-50 is demonstrable. `429` means it is not.

## The evaluation gap

CC-11 carries an eval harness and reports Recall@5 and MRR across three systems. CC-50 has no
equivalent and **should not pretend to**. A real evaluation needs a labelled set of photographed
questions with ground-truth transcriptions — perhaps 50 images across handwriting, print and
diagrams, in varying light — scored on character error rate and on whether the extracted question is
*answerable as asked*.

That set does not exist and cannot be built without quota to run it against. Building it is the
single highest-value follow-up here: "the vision model reads handwriting" is a feature claim,
whereas "CER 4.1% on 50 campus photos, 88% answerable-as-asked" is a result. The harness belongs at
`src/scripts/evalVision.ts`, alongside `evalRetrieval.ts` and `evalIntake.ts`.

## Rollback

Revert the code and drop the route. The migration is additive and nothing references the two
columns, so leaving it is harmless. Setting `VISION_ENABLED=false` disables the feature without a
deploy and is the correct first response to a quota incident.

## Open questions

1. Should a transcribed doubt be flagged to faculty in the queue, not just on the detail page?
   Leaning yes — it changes how carefully they read it.
2. Multi-image questions (a problem spanning two pages) — one call with two images, or two calls
   merged? Deferred until someone asks.
3. Should `legible: false` still let the student keep the attached image and type manually? Today it
   does; the image is already uploaded and the sweep will collect it if unused.
