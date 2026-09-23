# CC-30: Complaint photo evidence

| | |
|---|---|
| **Status** | **Implemented** 2026-09-23 — code complete and tested; EXIF strip needs one manual check |
| **Phase** | 3 |
| **Branch** | `feat/CC-30-complaint-evidence` |
| **Repos** | both |
| **Depends on** | CC-02 (bucket live 2026-09-22) |
| **Blocks** | nothing |
| **Estimate** | 3 days |
| **Shipped** | — |

## Problem

CC-02 shipped the "before" half — a student photographs the broken chair when filing. Three gaps
remained, and the middle one is the worst.

**1. No "after" photo.** `COMPLAINT_RESOLUTION` existed in the `AttachmentEntity` enum, in the read
authorization in `uploads.ts`, and in the orphan sweep. Nothing ever *created* one. The enum member
was scaffolding with no write path behind it.

**2. Staff could not see the "before" photo either.** `assignedComplaints` (faculty) and
`getAllComplaints` (admin) returned no attachments at all — neither called `listForEntities`. So the
faculty member assigned *"the third-row chair in ML02 is broken"* got the text and nothing else,
which is **precisely the round trip CC-30 exists to remove**. The photo was being uploaded, stored
and billed for, and the one person who needed it could not see it.

**3. EXIF was still attached.** CC-02 recorded this as a known gap and deferred it here, on the
reasoning that it becomes urgent once photos are routine — which is what this spec makes them.

## Goal

Evidence flows both ways. A student's photo reaches whoever fixes the fault; a photo of the repair
reaches the student deciding whether to accept it. Neither carries the location it was taken at.

## Non-goals / Out of scope

- **Video.** See below — this is a decision, not an omission.
- **Mandatory evidence.** See below.
- **Image processing**: no resizing, thumbnails or compression. The client-side re-encode shrinks
  photos as a side effect, but that is not what it is for.
- **A media gallery.** Files are reached through the complaint they belong to.

## Design

### Video is deliberately still excluded

The roadmap line says "photo/video". CC-02 allowed images and PDFs only and left widening the list
as "a one-line change once someone has measured what a 30-second phone clip does to the quota".

Measured: a 30-second 1080p clip from a modern phone is **40–60 MB**. The Supabase free tier gives
**1 GB total**. That is roughly **20 clips before the bucket is full** — at which point complaint
photos stop uploading for everyone. It also blows straight past `ATTACHMENT_MAX_BYTES` (5 MB), so
enabling video means raising the cap an order of magnitude on every entity at once.

A photo answers "which chair, how broken". Video answers almost nothing more, for 10–20× the
storage. Revisit if the project ever has paid storage; until then this is the right call and the
numbers are here so nobody has to redo them.

### Evidence is optional, on purpose

Requiring a resolution photo sounds like stronger accountability and is not. A genuinely fixed fault
in an unlit corridor could not be closed, so staff would learn to upload a blank frame to satisfy
the validation — and a mandatory field that is routinely satisfied with noise is worse than an
optional one that is usually meaningful, because it *looks* like evidence. There is a test asserting
the empty case is a silent no-op.

### Why `resolutionEvidence.ts` exists

Faculty and admins resolve complaints through separate handlers with already-different status rules
(`facultyController.updateComplaintStatus`, `adminController.updateComplaintStatus`). Duplicating
the evidence logic across both is how the two quietly diverge — one gains a check the other never
gets. One module, two call sites.

`withEvidence()` does the same for the read side, used by all three list endpoints, so the batching
cannot be right in one place and an N+1 in another. The N+1 here would be *doubled*: every complaint
has two kinds of attachment.

### Evidence binds after the status change, not inside it

`confirmAttachments` makes a network round trip per file to check each object's real size. Holding a
database transaction open across a third party's latency is how a slow bucket becomes a lock
contention incident.

The cost is that a failure between the two leaves the status changed and the photos unbound. Those
are `PENDING` rows, which the nightly sweep already collects — strictly better than a complaint that
cannot be resolved because storage was slow.

### EXIF stripping runs in the browser

`stripImageMetadata` re-encodes through a canvas before upload. Drawing to a canvas and reading it
back produces a new image *from pixels alone*: EXIF, XMP, IPTC, ICC and any vendor block are gone
because nothing carries them across. That is more thorough than parsing out the blocks we know
about, and it cannot be defeated by one we failed to anticipate.

**Why the browser and not the server**, since the server is where enforcement normally belongs:

- Stripping server-side means the original — GPS and all — is uploaded, stored, and only then
  cleaned. The coordinates would have existed in our bucket, in backups, and in whatever Supabase
  logs about the object. Here the bytes carrying them never leave the device.
- Server-side needs either `sharp` (a native binary, awkward on Vercel, large in a lambda) or a
  hand-written JPEG segment parser, plus a download and re-upload per photo against a 1 GB quota.

**What it does not defend against, stated plainly:** a deliberately malicious client can skip it and
upload raw bytes. Accepted — the threat model is *a student unknowingly leaking their own location*,
not an attacker choosing to publish their own coordinates. That is not a problem this feature needs
to solve, and no amount of client-side code would solve it anyway.

Ordering in the uploader matters twice: stripping runs **before** validation, because the re-encode
changes both type (HEIC → JPEG) and size. Validating first would pass a HEIC the server never sees,
and reject a 6 MB photo that would have come in under the cap once re-encoded.

> **A real bug this turned up.** The first version awaited an `Image` that fires `onload` or
> `onerror`. A browser that fires *neither* — genuinely possible for some malformed inputs — left
> the promise unsettled, `handleFiles` never returned, and the upload hung on a spinner forever:
> the exact opposite of the "never block the upload" guarantee. Found by the test that stubs a
> silent `Image`, which failed by timing out at 5s — precisely the symptom a student would have
> seen. Fixed with `DECODE_TIMEOUT_MS`.

### Where the "after" photos appear

On the student's complaint panel, **immediately above the confirm/reject buttons**. That placement
is the point: it is the evidence the decision rests on, and a photo below the buttons is a photo
half the students never scroll to.

## Acceptance criteria

10 of 13 covered by automated tests (32 assertions in `resolutionEvidence.test.ts` and
`stripImageMetadata.test.ts`).

1. Faculty moving a complaint to `PENDING_CONFIRMATION` can attach photos of the repair.
2. Admins can do the same on `PENDING_CONFIRMATION` and `RESOLVED`.
3. Evidence is rejected with 400 on any other status.
4. Omitting evidence is a silent no-op, never an error.
5. Attaching another user's upload returns 403 (delegated to `confirmAttachments`).
6. Faculty see the student's photos on their assigned complaints.
7. Admins see both halves on the complaints list.
8. Students see before and after, with the after directly above confirm/reject.
9. List responses expose only `id`, `mimeType`, `originalName`, `sizeBytes` — never `storagePath`.
10. Two attachment queries per page regardless of page size.
11. A JPEG from a phone arrives in the bucket with **no GPS block** *(manual)*.
12. A PDF is never re-encoded.
13. An undecodable image still uploads, with the student warned *(partially automated)*.

## Test plan

- **Unit:** status gating for every complaint status; the empty/malformed `attachmentIds` cases;
  error propagation from `confirmAttachments`; `withEvidence` field projection and query count.
  Pass-through routing and every failure path of the stripper, including the silent-`Image` hang.
- **Not unit-testable:** the canvas re-encode itself. jsdom implements the canvas *element* but not
  its rendering context, so `toBlob` needs the native `canvas` package — a compiled dependency added
  to exercise code whose whole purpose is to run in a real browser. Recorded so nobody assumes the
  coverage gap is an oversight.
- **Manual (criterion 11):** upload a phone photo with location services on, download it back
  through a signed URL, and confirm `exiftool` reports no GPS block:
  ```bash
  exiftool -gps:all -model downloaded.jpg   # expect no output
  ```

## Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Client skips stripping and uploads raw EXIF | Low | Medium | Accepted; outside the threat model, stated above |
| Browser cannot decode HEIC, metadata survives | Medium | Medium | Student warned per batch; Safari (where HEIC actually originates) decodes it |
| Re-encode degrades evidence quality | Low | Low | Quality 0.92; invisible on a photo of a broken chair |
| Status changes but evidence fails to bind | Low | Low | `PENDING` rows collected by the nightly sweep |
| Storage quota consumed faster now photos are routine | Medium | Medium | 5 MB cap, 5 per entity, sweep; video excluded on the numbers above |
| Orientation lost with the EXIF tag | Low | Medium | Every supported browser applies orientation at decode; noted in the code |

## Rollback

No migration — `COMPLAINT_RESOLUTION` already existed. Revert the code and resolution photos stop
being offered; rows already written stay readable, since the read path is the generic one.

## Open questions

1. Should rejecting a resolution require the student to say *why* when an after-photo was provided?
   Today the reason is optional either way.
2. Retention for resolved-complaint photos — touches CC-64, and was already flagged as belonging
   there rather than here.
3. Should a resolution photo be required for `RESOLVED` specifically, where an admin closes without
   student confirmation? That is the one case with no second pair of eyes.
