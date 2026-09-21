# CC-02: File storage layer

| | |
|---|---|
| **Status** | **Dormant** — code complete 2026-09-21, switched off pending Supabase access |
| **Phase** | 0 |
| **Branch** | `feat/CC-02-file-storage` |
| **Repos** | both |
| **Depends on** | CC-01 (shipped), CC-04 (shipped) |
| **Blocks** | CC-23, CC-24, CC-30, CC-50 |
| **Estimate** | 3 days |
| **Shipped** | — |

## Problem

Nothing in CampusCure can carry a file. There is no `Attachment` model in `prisma/schema.prisma`, no
storage client anywhere in `src/`, and no upload endpoint in any of the four route modules.

The cost is concentrated in complaints. `raiseComplaint`
(`src/controllers/studentController.ts:361`) accepts a text description and nothing else, so "the
third-row chair in ML02 is broken" has to be typed, read, interpreted, and then verified in person.
CC-30 exists to remove that round trip and cannot start. CC-24 (doubt attachments), CC-23 (rich text
with embedded images) and CC-50 (image doubts, which needs an image to hand to a vision model) are
blocked on the same missing layer.

Three separate features waiting on one absent primitive is the argument for speccing it alone.

## Goal

Any authenticated user can attach a file to a doubt, answer or complaint. The bytes go straight from
the browser to Supabase Storage over a short-lived signed URL that the backend issues; the backend
records what was uploaded, by whom, and what it belongs to, and serves reads back through signed
download URLs. No file is ever public, and no request body ever carries file bytes.

## Non-goals / Out of scope

- **Any feature that consumes attachments.** This spec ships the layer and exactly one thin
  integration to prove it (complaint evidence, read and write). The doubt, answer and rich-text
  surfaces are CC-24, CC-30 and CC-23. Resist adding them here.
- **Image processing** — no resizing, thumbnails, compression, EXIF stripping or transcoding.
  Recorded as a known gap under Risks.
- **Virus scanning.** Out of reach on a free tier; mitigated by an extension/MIME allow-list and a
  private bucket. An accepted risk, not an oversight.
- **Video.** CC-30 mentions video; this spec allows images and PDFs only. Widening the allow-list is
  a one-line change once someone has measured what a 30-second phone clip does to the quota.
- **A media library or file browser UI.** Files are reached through the entity they belong to.
- **CDN, custom domain, or public URLs.**

## Design

### Why direct-to-storage, and why it is not optional

The backend runs as a Vercel serverless function (`api/index.ts`). Request bodies there are capped at
4.5 MB, and the function bills for the whole time it holds a connection open. Proxying a phone photo
through Express means a bigger multipart body, a slower function, and a hard ceiling that a modern
camera clears on its own.

So the bytes never touch our function. The flow is three steps:

```
  browser                     backend                    Supabase Storage
     |  POST /api/uploads/sign   |                              |
     |-------------------------->|  validate role, MIME, size   |
     |                           |  INSERT Attachment (PENDING) |
     |                           |  createSignedUploadUrl() ----->
     |  { attachmentId, url }    |<-----------------------------|
     |<--------------------------|                              |
     |  PUT <url>  (the bytes)   |                              |
     |------------------------------------------------------------>
     |                           |                              |
     |  POST /complaints/new { attachmentIds: [...] }           |
     |-------------------------->|  verify owner + PENDING      |
     |                           |  HEAD object, confirm size   |
     |                           |  UPDATE -> ATTACHED          |
```

`SUPABASE_SERVICE_ROLE_KEY` stays server-side. The browser receives a URL scoped to one object path,
valid for minutes.

### Schema

```prisma
enum AttachmentStatus {
  PENDING   // signed, not yet confirmed — invisible to every read path
  ATTACHED  // confirmed and bound to an entity
}

enum AttachmentEntity {
  DOUBT
  ANSWER
  COMPLAINT
  COMPLAINT_RESOLUTION  // the "after" photo — CC-30
}

model Attachment {
  id           String            @id @default(uuid())
  /// Object key inside the bucket. Server-generated, never client-supplied:
  /// a client-chosen path is a path-traversal and overwrite primitive.
  storagePath  String            @unique
  bucket       String
  mimeType     String
  sizeBytes    Int
  originalName String
  status       AttachmentStatus  @default(PENDING)
  /// Null until confirmed. A PENDING row is a reservation, not a file.
  entityType   AttachmentEntity?
  entityId     String?
  uploadedById String
  uploadedBy   User              @relation(fields: [uploadedById], references: [id], onDelete: Cascade)
  createdAt    DateTime          @default(now())
  confirmedAt  DateTime?

  @@index([entityType, entityId])
  @@index([uploadedById])
  @@index([status, createdAt])  // the orphan sweep
}
```

Migration: `npx prisma migrate dev --name cc02_add_attachment`.

`entityId` is deliberately **not** a foreign key. Four possible parents cannot be expressed as one
relation in Prisma, and the alternative — four nullable FK columns — makes every read path branch on
which one is set. The cost is that deleting a doubt does not cascade to its attachments; the sweep
below covers that. `EmbeddingJob` already makes the same trade-off with its `entityType`
discriminator (`prisma/schema.prisma:276`), so this keeps the codebase consistent with itself.

### Storage layout

Bucket `campuscure-attachments`, **private**. A public bucket is wrong here: a complaint photo can
show an identifiable person in a hostel corridor, and a public URL is permanent and unauthenticated.

```
{entityType}/{entityId or "pending"}/{attachmentId}.{ext}
```

The object name is the attachment UUID, never `originalName`. That keeps a user-controlled string out
of the key entirely, while the original filename is preserved in its own column for display and
download.

### New modules

| File | Responsibility |
|---|---|
| `src/services/storage/supabaseStorage.ts` | The only module that talks to Supabase. Signed upload, signed download, head, delete. |
| `src/services/storage/attachments.ts` | Reserve, confirm, resolve-for-entity, sweep. No HTTP. |
| `src/routes/uploads.ts` | The two endpoints below. |
| `src/middleware/rateLimit.ts` | Add `uploadLimiter` alongside the existing limiters. |

Per the conventions in `docs/README.md`, no SDK call appears in a controller.

### Endpoints

**`POST /api/uploads/sign`** — auth required, any role.

```jsonc
// request
{ "entityType": "COMPLAINT", "mimeType": "image/jpeg", "sizeBytes": 2411233, "originalName": "chair.jpg" }
// 201
{ "attachmentId": "uuid", "uploadUrl": "https://...", "token": "...", "expiresInSeconds": 300 }
```

Rejects with 400 on a MIME type outside the allow-list or a size over the cap, and 429 via
`uploadLimiter`. Note that `sizeBytes` here is a *claim* — it is checked again after upload.

**`GET /api/attachments/:id`** — auth required. Returns `{ url, expiresInSeconds }`, a signed
download URL valid for 5 minutes. Authorization is delegated to the parent entity: the caller must be
able to read the doubt/answer/complaint the attachment is bound to. A `PENDING` attachment is
readable only by its uploader.

Confirmation is **not** its own endpoint. It happens inside the entity's existing create/update
handler, in the same transaction that creates the entity, so an attachment cannot be confirmed
against a complaint that failed validation.

### Limits and allow-list

```ts
export const ATTACHMENT_MAX_BYTES = Number(process.env.ATTACHMENT_MAX_BYTES ?? 5 * 1024 * 1024);
export const ATTACHMENT_MAX_PER_ENTITY = Number(process.env.ATTACHMENT_MAX_PER_ENTITY ?? 5);
export const ALLOWED_ATTACHMENT_MIME = new Set([
  "image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf",
]);
```

`image/heic` is on the list because it is the iPhone default, and omitting it means silently
rejecting a large share of the student body's camera output.

New env vars, all **required** — unlike the AI block in `src/config/env.ts:150`, which is optional by
design. An attachment layer that half-works is worse than one that is switched off.

| Var | Purpose |
|---|---|
| `SUPABASE_URL` | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side only. Never sent to the browser. |
| `SUPABASE_STORAGE_BUCKET` | Defaults to `campuscure-attachments` |

Add all three to `.env.example` in the backend repo (CC-00 convention).

### Orphan sweep

Two ways to leak an object: a signed upload that is never confirmed, and an entity deleted while
holding attachments. Both are handled by one step added to the existing consolidated daily job in
`src/routes/internal.ts` (`dailyHandler`), alongside `embeddings`, `drafts` and
`purgedRefreshTokens`:

- `PENDING` rows older than 24 hours — delete the object, then the row.
- `ATTACHED` rows whose `entityId` no longer resolves — same.

Object first, then row. A row with no object shows a broken image; an object with no row is invisible
and bills forever.

### Frontend

- `src/api/uploads.ts` — `signUpload()`, `uploadToSignedUrl()`, `getDownloadUrl()`.
- `src/components/attachments/AttachmentUploader.tsx` — drag/drop or picker, per-file progress,
  client-side MIME and size pre-check (a courtesy, never the enforcement).
- `src/components/attachments/AttachmentList.tsx` — thumbnails for images, a filename chip for PDFs,
  click to open a freshly signed URL.
- `RaiseComplaint.tsx` gains the uploader; `MyComplaints.tsx` gains the list. That is the entire
  integration surface for this spec.

Signed download URLs expire, so they are fetched on render and never cached in TanStack Query with a
stale time longer than the URL's lifetime. This is the single easiest thing to get wrong here.

## Acceptance criteria

**Status 2026-09-21:** code complete; 10 of 14 covered by automated tests (51 new
assertions in `src/__tests__/unit/attachments.test.ts` and `uploads.test.ts`, plus two
rows in the authz matrix). Criteria 1, 8, 13 and 14 need a configured Supabase
bucket and the migration applied — see *Remaining setup* below.

1. A student can attach a JPEG to a new complaint and see it rendered in `MyComplaints`.
2. `POST /api/uploads/sign` returns 401 unauthenticated.
3. A `mimeType` outside the allow-list returns 400 and creates no row.
4. A `sizeBytes` over `ATTACHMENT_MAX_BYTES` returns 400 and creates no row.
5. A file whose *actual* uploaded size exceeds the cap is rejected at confirmation, the object is
   deleted, and the attachment never reaches `ATTACHED`.
6. A client-supplied `storagePath` is ignored; the object key is server-generated in every case.
7. `GET /api/attachments/:id` for an attachment on another student's complaint returns 403.
8. A signed download URL fetched by an authorized user resolves to the file.
9. Confirming an attachment owned by a different user returns 403.
10. Confirming an attachment that is already `ATTACHED` returns 409 — no re-parenting.
11. Attaching more than `ATTACHMENT_MAX_PER_ENTITY` files to one entity returns 400.
12. `PENDING` rows older than 24h are removed by the daily job, object first.
13. The bucket is private: the raw object URL without a signature is refused by Supabase.
14. With `SUPABASE_URL` unset the process fails to start with a `FATAL:` message naming the variable.

## Test plan

- **Unit:** allow-list and size validation; storage-path generation, including an `originalName` of
  `../../etc/passwd`; the confirm state machine (PENDING→ATTACHED and every rejected transition);
  sweep selection against a faked clock.
- **Integration:** both endpoints across all four roles, added to the existing matrix in
  `src/__tests__/authz/matrix.test.ts`. Supabase is mocked at the `supabaseStorage.ts` boundary —
  these tests must not touch the network.
- **Manual:** upload a real ~4 MB iPhone HEIC over campus wifi; confirm it lands, renders, and that
  the raw URL is refused once the signature is stripped.

## Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Free-tier storage quota (1 GB) exhausted | Medium | High | 5 MB cap, 5 files/entity, daily sweep; add a `/api/internal/storage/stats` counter to watch it |
| Malicious file uploaded (no AV) | Low | High | Private bucket, allow-list, no execution path, downloads served with `Content-Disposition: attachment` |
| Signed URL leaked from a shared screen | Medium | Low | 5-minute expiry, re-signed per view |
| Uploader lies about `sizeBytes` to bypass the cap | Medium | Medium | Re-checked against the object HEAD at confirmation (criterion 5) |
| EXIF GPS in complaint photos reveals a student's location | Medium | Medium | Known gap; EXIF stripping deferred to CC-30, where photos become routine |
| Orphaned objects accumulate silently | Medium | Low | Daily sweep, object-first deletion order |

## Rollback

Revert the code and drop the routes. **The migration is additive** — `Attachment` is a new table and
nothing else references it — so leaving it in place is harmless, while dropping it destroys the
record of what was uploaded. Prefer leaving it.

Objects already in the bucket are external state and are *not* removed by a code rollback. If the
feature is abandoned rather than deferred, empty the bucket manually, taking a backup first if any
complaint evidence has real value.

## Dormant by default

Nobody on the team has Supabase dashboard access at the time of writing, so the bucket
cannot be created and the feature cannot be exercised end to end. It is therefore
**switched off rather than half-built**, on one flag:

```ts
export const STORAGE_ENABLED = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
```

With it false — the state of any checkout without credentials:

- `POST /api/uploads/sign` and `GET /api/attachments/:id` answer **503**, after
  authenticating, so the authorization contract is unchanged.
- `listForEntity` / `listForEntities` return empty **without querying**. This matters
  more than it looks: the `Attachment` table has not been migrated, so a query would
  turn every complaint read into a 500.
- The nightly sweep is a no-op.
- Everything else in the app is untouched.

An earlier revision of this spec made the two variables **required**, reasoning that a
half-configured upload path silently loses files. That reasoning is right about the
upload and wrong about the process: it meant a developer without storage credentials
could not run doubts, complaints or auth either. Contain the failure at the feature,
not at the process.

Covered by `src/__tests__/unit/storageDisabled.test.ts` (6 tests), which is the
configuration the project is actually running in.

**Known rough edge:** the complaint form still renders the attachment picker while
storage is off, and a student who uses it sees "File uploads are not available on this
deployment." Hiding it needs a capability endpoint the frontend can read, which is not
worth building before the credentials exist.

## Remaining setup

Three steps that need credentials or a database, so they were not done as part of
implementation. Until all three are done, the feature stays dormant and harmless:

1. **Create the bucket.** Supabase → Storage → New bucket, named
   `campuscure-attachments`, with **Public bucket OFF**.
2. **Set the env vars** from `.env.example` (`SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`) locally and in Vercel. The process refuses to start
   without them, by design.
3. **Run the migration** — announce it first, per the migration discipline in
   `ROADMAP.md`, since only one person may generate one at a time:
   `npx prisma migrate dev --name cc02_add_attachment`.

Then walk criteria 1, 8, 13 and 14 by hand.

## Open questions

1. One bucket, or one per entity type? One is simpler and the path prefix already partitions it;
   per-bucket only helps if retention policies later diverge.
2. Should `ANSWER` be in `AttachmentEntity` from the start, given CC-24 is the consumer? Leaving it
   in costs nothing and avoids a second enum migration. Leaning yes.
3. Retention: do resolved-complaint photos get deleted after N months? That touches CC-64 (DPDP) and
   is better decided there than invented here.
