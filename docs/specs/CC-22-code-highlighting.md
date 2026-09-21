# CC-22: Code syntax highlighting

| | |
|---|---|
| **Status** | **Implemented 2026-09-21** — pending review/merge |
| **Phase** | 2 |
| **Branch** | `feat/CC-22-code-highlighting` |
| **Repos** | frontend |
| **Depends on** | none |
| **Blocks** | nothing |
| **Estimate** | 0.5 days |
| **Shipped** | — |

## Problem

CampusCure is a doubt forum for engineering students, and a large share of doubts are code. Today
every doubt body and every answer body is rendered as raw text in a single paragraph:

```tsx
// DoubtDetail.tsx:293
<p className="text-foreground whitespace-pre-wrap mb-4">{doubt.description}</p>
// DoubtDetail.tsx:387
<p className="text-foreground whitespace-pre-wrap mb-0 wrap-break-word">{answer.content}</p>
```

`whitespace-pre-wrap` preserves the newlines and the leading indentation, which is the minimum bar
and is genuinely doing real work — but the text renders in the body font, at body size, with no
delimitation between prose and code. A Python function, where indentation *is* syntax, is being
displayed in a proportional typeface alongside the sentence that introduces it. `wrap-break-word` on
the answer will also break a long identifier mid-token.

The faculty read surfaces (`FacultyDoubtDetail.tsx`, `FacultyDoubts.tsx`) have the same markup, so
the person best placed to answer a code question reads it in the worst possible form.

## Goal

A fenced code block inside a doubt or answer renders as a monospaced, syntax-highlighted block with
horizontal scrolling and a copy button, in both light and dark themes. Everything that is not inside
a fence continues to render exactly as it does today.

## Non-goals / Out of scope

- **The write path.** No editor, no toolbar, no preview, no autocompleted fences. Students type
  triple backticks by hand or get plain text. The editor is CC-23 (rich text), and this spec must not
  drift into it — that is the difference between half a day and four.
- **Markdown rendering.** Fenced code blocks are detected; `**bold**`, links, headings and lists are
  not. This is a deliberate line: full markdown on user-submitted content is an HTML sanitization
  problem, and taking it on turns a rendering tweak into a security review. CC-23 owns that with a
  sanitizer.
- **Math / KaTeX.** CC-23.
- **Inline code** (single backticks). Possible later; the block case carries essentially all the
  value.
- **Language auto-detection** when a fence carries no language tag. Guessing wrong is worse than not
  guessing; untagged fences render as plain monospace.
- **Server changes.** `Doubt.description` and `Answer.content` stay `String`. Nothing about the API
  changes.

## Design

### Parsing, not rendering-as-markdown

A tiny splitter turns a plain string into an ordered list of segments:

```ts
// src/lib/codeBlocks.ts
type Segment =
  | { kind: "text"; content: string }
  | { kind: "code"; lang: string | null; content: string };

export const splitCodeBlocks = (source: string): Segment[] => { /* ... */ };
```

It scans for ```` ``` ```` fences with an optional language tag on the opening line. An unterminated
fence is treated as text, not as a code block running to the end of the document — the failure mode
of a student typing three backticks mid-sentence must be "looks the same as today", never "the rest
of the post disappears into a grey box".

Text segments render through the **existing** `<p className="whitespace-pre-wrap">`. There is no
`dangerouslySetInnerHTML` anywhere on a text segment. That is what keeps this out of XSS territory.

### Shiki

Shiki is the right choice over Prism or highlight.js: it uses real TextMate grammars, so its output
matches VS Code, and it is the one the roadmap already names.

Bundle size is the entire engineering concern. The full package carries every grammar and theme and
is measured in megabytes, which is unacceptable on campus wifi for a feature this cosmetic. So:

- Import from `shiki/core` with `createHighlighterCore`, not the convenience bundle.
- Load exactly these grammars: `c`, `cpp`, `java`, `python`, `javascript`, `typescript`, `sql`,
  `json`, `bash`. That list is the engineering syllabus; anything else falls back to plain monospace.
- **Dynamic `import()`**, triggered only when a rendered post actually contains a code block. A
  student reading a prose-only thread never downloads a highlighter.
- One module-level singleton promise, so ten code blocks on one page initialize it once.

```ts
// src/lib/highlighter.ts — created on first use, reused thereafter
let highlighterPromise: Promise<HighlighterCore> | null = null;
export const getHighlighter = () => (highlighterPromise ??= createHighlighterCore({ /* ... */ }));
```

### Theming

The app uses `next-themes` and a `.dark` class. Shiki's dual-theme output (`github-light` /
`github-dark`) emits CSS variables on a single render, so the theme switches with CSS and does not
require re-highlighting. This avoids a flash on toggle and keeps the highlighter from running twice.

Shiki's own output *is* trusted HTML — it is generated from the grammar, not from the user string —
so `dangerouslySetInnerHTML` is acceptable on a code segment specifically. Worth a comment in the
code saying exactly that, because it will otherwise look like an oversight to the next reader.

### Component

`src/components/content/PostBody.tsx` — takes a string, renders segments, and is dropped into all
four read sites:

| File | Line |
|---|---|
| `src/pages/student/DoubtDetail.tsx` | 293 (description), 387 (answer) |
| `src/pages/faculty/FacultyDoubtDetail.tsx` | the equivalent body renders |
| `src/pages/student/DoubtCommunity.tsx` | card preview — **plain text only**, see below |

The list card at `DoubtCommunity.tsx` deliberately does **not** highlight. A truncated preview of a
code block is noise, and initializing a highlighter for every card in a list is exactly the
performance mistake the dynamic import is there to avoid. Cards strip fences and show the prose.

`CodeBlock` handles the block itself: `overflow-x-auto` (never wrap code), a language label, and a
copy-to-clipboard button using the existing `sonner` toast for confirmation.

## Acceptance criteria

**Status 2026-09-21:** implemented. Criteria 1-7, 9-12 are covered by the 25 tests in
`CampusCure_Frontend/src/lib/codeBlocks.test.ts` plus the build output; 8 and 13 need a
browser and are listed under *Manual verification* below.

1. A doubt containing a ```` ```python ```` fence renders highlighted, monospaced, in a bordered
   block.
2. Prose around the fence renders exactly as before, with newlines and indentation preserved.
3. A post with no fence renders identically to today and downloads no highlighter chunk.
4. An untagged fence renders as an unhighlighted monospace block, not an error.
5. A fence in an unsupported language renders as plain monospace, not an error.
6. An unterminated fence renders as plain text; no content is swallowed.
7. A long line inside a code block scrolls horizontally and does not wrap or break tokens.
8. Switching to dark mode restyles code blocks without a re-render flash.
9. Copy-to-clipboard copies the exact source, without the fence markers or the language tag.
10. A code block containing `<script>alert(1)</script>` displays as text and does not execute.
11. The faculty detail view highlights the same content the student view does.
12. The `DoubtCommunity` list card shows no highlighted block.
13. Ten code blocks on one page initialize the highlighter once.

## Test plan

- **Unit:** `splitCodeBlocks` — no fence, one fence, several fences, fence at the very start, fence at
  the very end, unterminated fence, empty fence, fence with a language tag, fence with an unknown
  language tag, and backticks appearing inside prose.
- **Component:** `PostBody` renders text and code segments in the right order; criterion 10 asserted
  explicitly.
- **Manual:** paste a real 40-line Java class into a doubt and read it on a phone; toggle dark mode;
  check the network panel confirms no Shiki chunk on a prose-only thread (criterion 3).

## Manual verification outstanding

Two criteria cannot be asserted without a running browser, and the frontend has no
component-testing harness (see *Deviations*):

- **8** — dark mode restyles code blocks without a re-render flash.
- **13** — ten blocks on one page build one highlighter.

Both are structurally provided for: dual-theme output means the theme switch is pure
CSS, and the highlighter is a single module-level promise. Neither is asserted.

## Deviations from the spec as written

1. **Grammars load per language, not all nine up front.** The spec said to pass the
   nine grammars to `createHighlighterCore`. Doing that made the constructor await
   every one, so the first Python block also pulled C++ — whose grammar alone minifies
   to 797 kB. Measured totals: ~1.5 MB eager versus ~240 kB for core + engine + one
   grammar. `highlighter.ts` now attaches a grammar on demand and caches per language.
2. **A test runner was added to the frontend.** There was none. `vitest` plus a
   ten-line config, `node` environment, no jsdom — enough for the parser, which is a
   pure function and the only part of this with real edge cases. A component-testing
   harness was not built; that is why criteria 8 and 13 are manual.
3. **`FacultyDoubts.tsx` also strips fences** in its card preview. The spec named only
   `DoubtCommunity.tsx`, but the faculty list renders the same truncated description
   and had the same problem.

## Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Bundle size regression | Medium | Medium | Fine-grained core import, nine grammars, dynamic load; record the chunk size in the PR |
| XSS via `dangerouslySetInnerHTML` | Low | High | Used only on Shiki output, never on a user string; text segments stay in React children |
| Highlighter init blocks first paint | Low | Medium | Async with a plain `<pre>` fallback rendered immediately and swapped on resolve |
| Students never learn to type fences | High | Low | Real limitation, and the honest reason CC-23 exists. A placeholder hint in the compose box costs nothing |
| Scope creep into full markdown | Medium | Medium | Non-goals list; if bold text gets requested, it is CC-23 |

## Rollback

Frontend-only, no migration, no API change. Revert the commit and remove the dependency. Nothing
persists — existing posts already contain whatever backticks their authors typed, and they render as
literal backticks again, exactly as they do today.

## Open questions

1. Should the compose box show a hint about triple backticks? It is one line of placeholder text and
   makes the difference between a feature students use and one they never discover. Leaning yes,
   though it is technically write-path.
2. Line numbers on blocks over ~15 lines? Useful when faculty reply "line 7 is the bug", and they are
   a Shiki transformer rather than custom code. Cheap, but not needed to ship.
