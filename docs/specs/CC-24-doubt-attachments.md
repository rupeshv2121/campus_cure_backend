# CC-24: Doubt and answer attachments

| | |
|---|---|
| **Status** | **Implemented 2026-09-21** — inert until CC-02 has a bucket |
| **Phase** | 2 |
| **Branch** | `feat/CC-24-doubt-attachments` |
| **Repos** | both |
| **Depends on** | CC-02 (merged, dormant) |
| **Blocks** | nothing |
| **Estimate** | 2 days |
| **Shipped** | — |

## Problem

A doubt is text and nothing else. A student whose question is *"why does this throw?"* has to
retype the error, and a faculty member answering *"look at this diagram"* has no way to show one.

CC-02 built the whole storage layer for exactly this and wired it to complaints only. The
`AttachmentEntity` enum already contains `DOUBT` and `ANSWER`; nothing ever writes them.

## Goal

A doubt or an answer can carry images and PDFs, using the storage layer that already exists.

## Non-goals / Out of scope

- **Activating CC-02.** It is dormant pending a Supabase Storage bucket, and this spec does not
  change that. What it does is make the doubt community ready, so the bucket switches on four
  features rather than one. Everything here is inert until then, by the same `STORAGE_ENABLED`
  flag — see *Shipping against a dormant dependency*.
- **Inline images inside the text.** That is CC-23's editor. These are attachments listed beside
  the post, not embedded in it.
- **Video.** CC-02 allows images and PDFs; widening the allow-list is one line there, not here.
- **Attachments on AI-drafted answers.** CC-12 drafts are generated text with no upload path.
- **Editing attachments after posting.** Add on create, remove by deleting the post.

## Design

### Almost all of this already exists

CC-02 shipped signed direct upload, the `Attachment` model, `confirmAttachments`,
`listForEntities`, per-entity authorization and the orphan sweep. What is missing is three lines
in two handlers and a read path:

| Step | Status |
|---|---|
| `POST /api/uploads/sign` with `entityType: "DOUBT"` | Already works |
| Browser PUTs to storage | Already works |
| `postDoubt` / `postAnswer` accept `attachmentIds` | **This spec** |
| Confirm inside the creating transaction | **This spec** |
| Return attachments on read | **This spec** |
| Signed download, authorization, sweep | Already works |

The authorization rule CC-02 wrote for `DOUBT` and `ANSWER` — readable by any authenticated
member, because the doubt community is one — is already in `canRead`.

### Confirmation is transactional where the write is

`postDoubt` already runs in a transaction, so the confirmation joins it: a doubt that fails
validation cannot leave files claiming to belong to it. `postAnswer` likewise.

This is the same contract as complaints, and the reason `confirmAttachments` takes an optional
`tx`.

### Shipping against a dormant dependency

CC-02 is switched off without Supabase credentials. Every path here inherits that:
`listForEntities` already returns empty when storage is off, and `confirmAttachments` throws a
503 that the handlers turn into a clean error rather than a 500.

So this ships **inert and harmless**, and becomes live the moment the bucket exists — with no
further code change. Stated plainly because "you built a feature that does nothing" is the
obvious reading otherwise, and the alternative — waiting — means the bucket unblocks one feature
instead of four.

### Frontend

The `AttachmentUploader` and `AttachmentList` components from CC-02 are reused unchanged, with
`entityType="DOUBT"` and `"ANSWER"`. The ask-a-doubt modal and the answer form gain an uploader;
the detail page renders the list under each post.

## Acceptance criteria

1. Posting a doubt with `attachmentIds` binds them to that doubt.
2. Posting an answer with `attachmentIds` binds them to that answer.
3. A doubt that fails validation binds nothing.
4. Attachments appear on the doubt detail response.
5. Attachments appear per answer.
6. A doubt with no attachments returns an empty list, not null.
7. Attaching a file uploaded by another user is refused.
8. Re-binding an already-attached file is refused.
9. With storage off, posting still works and returns no attachments.
10. With storage off, posting *with* attachment ids gives a clean 503, not a 500.

## Test plan

- **Unit:** the two handlers pass ids and the transaction to `confirmAttachments`; read paths
  attach the right lists; the storage-off path.
- **Integration:** post a doubt with attachments across roles.
- **Manual:** blocked on the bucket — the one thing that cannot be checked until CC-02 is live.

## Implementation notes 2026-09-21

Built. 7 tests; 647 backend tests total. No migration — CC-02's schema already covered
this entirely, which was the point.

**It does nothing yet, on purpose.** Everything inherits CC-02's `STORAGE_ENABLED`
flag: `listForEntities` returns an empty map without querying, and `confirmAttachments`
refuses with a 503 that the handlers turn into a clean error. Posting a doubt or an
answer works exactly as before.

The moment the Supabase bucket exists, this is live with no further code change — and
the bucket then switches on complaints, doubts and answers together rather than
complaints alone.

`AttachmentList` gained a `className` passthrough so it can sit inside the doubt body
without extra wrapping.

## Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Ships dead and is forgotten | Medium | Low | Spec and commit say so; inert by the same flag as CC-02 |
| Attachment failure blocks posting a doubt | Low | Medium | Confirmation is in the transaction; a clean 4xx, never a 500 |
| Students attach large files to every doubt | Low | Medium | CC-02's 5 MB and 5-per-entity caps apply unchanged |

## Rollback

Revert. No migration — CC-02's schema already covers this entirely.

## Open questions

1. Should an answer's attachments be visible before moderation approves it? Currently they follow
   the answer, which is the simplest rule and matches how its text behaves.
