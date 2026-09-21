# CC-23: Rich text for doubts and answers

| | |
|---|---|
| **Status** | **Implemented 2026-09-21** — migration applied; images still pending CC-02 |
| **Phase** | 2 |
| **Branch** | `feat/CC-23-rich-text` |
| **Repos** | both |
| **Depends on** | CC-02 (merged, dormant) — for images only |
| **Blocks** | nothing |
| **Estimate** | 4 days |
| **Shipped** | — |

## Problem

A doubt is a `<textarea>`. A student cannot emphasise the line that matters, number the three
things they tried, or write an equation — and an engineering doubt is very often an equation.

CC-22 made fenced code blocks render properly, which fixed the single worst case. It did so
without an editor, deliberately, and its spec says so: *"students type triple backticks by hand
or get plain text"*. That is the gap this closes.

## Goal

Doubts and answers can be written with formatting and mathematics, and everything already
written keeps rendering exactly as it does now.

## Non-goals / Out of scope

- **Images inside the text.** That needs CC-02's bucket, which is dormant. CC-24 already
  attaches files *beside* a post; embedding them *inside* it waits. Keeping images out is what
  makes this shippable today rather than blocked.
- **Tables, mentions, collaborative editing.** Not asked for.
- **Rewriting existing posts into HTML.** See *Two formats, forever*.
- **Rich text anywhere else** — complaints, resolution notes. A complaint is a description of a
  broken chair and does not need italics.
- **Markdown as the storage format.** HTML is what the editor produces; converting to Markdown
  and back loses fidelity for no gain here.

## Design

### Two formats, forever

Every existing doubt and answer is plain text, and CC-22 renders it with fenced-code support.
Rewriting those rows into HTML would be a lossy, irreversible migration of user-authored content
to fix a problem nobody has.

So the column gains a sibling:

```prisma
descriptionFormat ContentFormat @default(TEXT)   // Doubt
contentFormat     ContentFormat @default(TEXT)   // Answer
```

Existing rows default to `TEXT` and keep going through CC-22's `PostBody`. New rows written by
the editor are `HTML`. The renderer branches on the column rather than guessing from the content,
because guessing ("does it start with `<`?") is wrong for any student who legitimately types a
`<` as the first character.

This is not a temporary state to be migrated away. Plain text is a perfectly good format and
some posts will always be written by an API or a script.

### Sanitisation is the whole security story

Storing user-authored HTML and rendering it is an XSS vulnerability unless something strips it,
and CC-22 explicitly refused to go near HTML for exactly this reason.

**Sanitisation happens on the server, on write.** Not in the browser, not on read:

- the browser cannot be trusted — the editor is only a convenience, and `POST` accepts whatever
  a client sends;
- sanitising on read means the dangerous string is in the database, one forgotten render away
  from executing.

`sanitize-html` with a tight allow-list: `p`, `br`, `strong`, `em`, `u`, `s`, `h2`–`h4`, `ul`,
`ol`, `li`, `blockquote`, `code`, `pre`, `a`, `span`. Attributes are `href` on `a` (http, https,
mailto only) and `class` on `span` and `code` — the latter because KaTeX and the code highlighter
need it. Everything else is dropped, including every `on*` handler, `style`, `script`, `iframe`
and `javascript:` URL.

Links get `rel="noopener noreferrer nofollow"` and `target="_blank"` added, so a doubt cannot be
used to pass referrer data or gain window access.

### Math

TipTap writes math as `<span class="math-inline">` / `<span class="math-block">` with the LaTeX
as text content. KaTeX renders it in the browser at read time.

Rendering at read time rather than storing rendered KaTeX output keeps the source editable and
keeps a KaTeX upgrade from requiring a data migration. The LaTeX itself is text inside a span, so
it passes the sanitiser untouched and cannot carry script.

KaTeX is loaded dynamically, only when a post actually contains math — the same reasoning CC-22
applied to Shiki, and for the same reason: a student reading a prose thread should not download a
maths typesetter.

### Plain text is still accepted

The API takes either format. A client that posts plain text gets `TEXT` and CC-22's renderer;
the editor posts `HTML`. Nothing that works today stops working, which matters because the
chatbot (CC-15) and the AI draft generator (CC-12) both write answer text programmatically.

### Search and embeddings keep working

CC-10's embedding pipeline and CC-11's search read `description` and `content` directly. HTML
tags in an embedding input are noise. So both paths strip tags to plain text before use — one
helper, applied where the text is consumed rather than where it is stored.

## Acceptance criteria

1. A doubt posted as HTML stores `descriptionFormat = HTML`.
2. A doubt posted as plain text stores `TEXT` and renders as before.
3. Existing rows are unchanged and still render.
4. `<script>` is stripped on write, not on read.
5. `onerror` and other `on*` attributes are stripped.
6. `javascript:` hrefs are stripped.
7. `style` attributes are stripped.
8. `iframe`, `object` and `embed` are stripped.
9. Allowed formatting — bold, lists, links, headings, blockquote — survives.
10. A link gains `rel="noopener noreferrer nofollow"` and `target="_blank"`.
11. KaTeX spans and their class survive sanitisation.
12. Answers sanitise identically to doubts.
13. Embedding input has tags stripped.
14. Search input has tags stripped.
15. The stored value is the sanitised one — the raw input never reaches the database.

## Test plan

- **Unit:** the sanitiser against a battery of payloads — script tags, event handlers,
  `javascript:`, data URIs, nested/malformed markup, style, iframe; allowed formatting survives;
  KaTeX spans survive; tag stripping for embeddings.
- **Integration:** post a doubt and an answer in both formats.
- **Manual:** write a doubt with a list, a link, a code block and an equation; confirm it renders
  and that a pasted `<img onerror=alert(1)>` does not.

## Implementation notes 2026-09-21

Built, migration applied. 26 tests; 673 backend tests total.

**A test caught a real hole in the sanitiser.** `transformTags` added
`rel="noopener noreferrer nofollow"` and `target="_blank"` to links — and
`allowedAttributes.a` then stripped them again, because sanitize-html transforms
first and filters attributes second. Links were not hardened at all. Both attributes
are now on the allow-list, and the test that found it asserts the output.

Client-side length checks measure **visible text**, not markup: `<p>hi</p>` is nine
characters of which two are the answer, so a raw `min(20)` on the description would
have been satisfied by an empty paragraph plus a tag.

KaTeX builds as its own 262 kB chunk and loads only when a post contains math — the
same treatment CC-22 gave Shiki, for the same reason.

Images are still out, as specced: `img` is stripped by the sanitiser and the editor has
no image affordance, so nothing offers a student something that would silently fail
while CC-02 is dormant.

## Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| XSS through stored HTML | Medium without care | **High** | Server-side allow-list sanitisation on write; 8 of 15 criteria are about this |
| Sanitiser strips something legitimate | Medium | Low | Explicit allow-list, easy to extend, tested both ways |
| Existing plain-text posts break | Low | High | Format column; default `TEXT`; nothing rewritten |
| Editor bundle weight | Medium | Medium | TipTap is tree-shaken; KaTeX loads only when math is present |
| HTML pollutes embeddings and search | Medium | Medium | Tags stripped at the point of consumption; criteria 13-14 |

## Rollback

Revert. The migration adds two defaulted enum columns and is additive; posts written as `HTML`
would then render as escaped text rather than as markup — visible, ugly, not lost. Leaving the
columns costs nothing.

## Open questions

1. Should the editor be offered for complaints too? Currently no — a complaint describes a broken
   chair.
2. Inline images once CC-02 is live: the uploader exists, so it is mostly editor wiring.
3. Should `descriptionFormat` eventually accept `MARKDOWN`? Only if something starts producing it.
