# ADR-0001: AI provider strategy

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-08-16 |
| **Supersedes** | — |

## Context

The Phase 1 roadmap needs three distinct AI capabilities:

1. **Text embeddings** — semantic doubt search (CC-11), complaint deduplication (CC-13)
2. **Text generation** — answer drafting (CC-12), complaint field extraction (CC-14), chatbot with
   tool calling (CC-15)
3. **Vision** — reading handwritten doubt photos (CC-50)

The original project plan named Sentence Transformers, BERT, and FAISS. **None of these can run in
our deployment target.** The backend is a Vercel serverless function
(`campus_cure_backend/api/index.ts`): Sentence Transformers and BERT are Python, FAISS needs a
persistent process and local filesystem, and the lambda has a ~250MB bundle limit plus cold starts.

Available credentials: HuggingFace, Groq, Mistral.

## Decision

Use hosted inference APIs only, **on free tiers only**. No self-hosted model servers, no models in
the lambda bundle, no paid plans. Zero marginal cost is a hard constraint, not a preference.

| Capability | Primary | Fallback |
|---|---|---|
| Embeddings | HuggingFace Inference — `sentence-transformers/all-MiniLM-L6-v2` (384-dim), open model | **none** — retry + queue (see below) |
| Generation | Groq — free tier, fast, OpenAI-compatible tool calling | Mistral free tier |
| Vision | Mistral — Pixtral, free tier | — |

All three providers offer a free tier sufficient for a single-campus workload. Choose **open-weight
models** (Llama, Mistral, MiniLM) over proprietary ones throughout — they are the ones available free,
and they keep the self-hosting escape hatch open, since the same weights can be run locally later
without changing the interface.

All provider access sits behind interfaces in `campus_cure_backend/src/services/ai/`. Controllers
never import a provider SDK. Model IDs come from environment variables, never hardcoded.

```
src/services/ai/
├── types.ts              EmbeddingProvider, ChatProvider, VisionProvider
├── embeddings/
│   ├── huggingface.ts
│   └── index.ts          selection + retry
├── chat/
│   ├── groq.ts
│   ├── mistral.ts
│   └── index.ts          primary → fallback chain
└── vision/
    └── mistral.ts
```

## The embedding fallback trap

**Generation can fail over between providers. Embeddings cannot.**

Vectors from different models are not comparable. `all-MiniLM-L6-v2` produces 384 dimensions and
`mistral-embed` produces 1024 — they are not merely different sizes, they are different vector
spaces. Writing a Mistral vector into a column of MiniLM vectors silently corrupts the index: the
column still accepts writes, queries still return rows, and the results are meaningless. This is a
data-integrity bug with no error message, and it is the most likely serious mistake in Phase 1.

Therefore:

- **One canonical embedding model.** `all-MiniLM-L6-v2` at 384 dimensions.
- Embedding failure is handled by **retry and queue**, never by substituting a provider.
- Every embedding row stores `embedding_model` and `embedding_version` alongside the vector. A model
  change is then a detectable, backfillable migration rather than silent corruption.
- CC-10 refuses to write a vector whose model tag doesn't match the configured canonical model.

## Consequences

**Good**

- Nothing extra to deploy. Vercel serverless stays viable, no Python service, no GPU host.
- Groq is genuinely fast (sub-second for short completions), which makes CC-15 feel interactive.
- Provider interfaces mean swapping HuggingFace for a self-hosted MiniLM later is a one-file change —
  the escape hatch stays open without paying for it now.

**Bad / risky**

- **Free tiers impose hard rate limits, and those limits shape the architecture.** This is the single
  biggest consequence of this ADR. Expect per-minute request caps, per-day token caps, and cold
  starts on sleeping HuggingFace models (first call can take 20+ seconds or return 503). Concretely,
  every AI feature must:
  - **batch** — one request for many items, never one request per item;
  - **queue and retry** rather than call inline, so a 429 delays work instead of failing it;
  - **cache** — never re-embed unchanged text, never re-answer an identical question;
  - **degrade** — a rate-limited provider produces a reduced experience, never an error page.

  Exact limits are not documented here because providers change them without notice. Check each
  provider's current free-tier limits when implementing CC-10 and record what you found in that spec.
- **A demo can exhaust a daily quota.** Before any live presentation, pre-warm caches and pre-compute
  embeddings. Never let the first run of a feature happen in front of an examiner.
- Third-party availability is now on our critical path. Every AI feature degrades gracefully:
  CC-11 falls back to keyword search, CC-12 shows no draft, CC-15 shows an error. **No AI failure may
  ever block a core action** — posting a doubt or filing a complaint must always succeed.
- Hosted model IDs are deprecated with little notice, and free tiers churn models fastest. Env vars,
  plus a startup log line recording which model actually answered.
- **Per-user rate limiting is mandatory before any AI endpoint ships**, and on a free tier it
  protects availability rather than a bill: one user in a loop can exhaust the shared quota for the
  entire campus. This is why CC-01 blocks all of Phase 1.
- Free tiers generally offer **no uptime guarantee and no support**. Provider outage is a normal
  operating condition here, not an incident. Every consumer degrades gracefully by design.

**Academic note** — "we called an API" is a weaker story than "we built it." The counterweight is
CC-11's evaluation harness: comparing keyword vs vector vs hybrid retrieval with real metrics on a
labelled set is the actual research contribution. The engineering contribution is the pipeline and
the fusion, not the transformer weights.

## Alternatives considered

| Option | Rejected because |
|---|---|
| `transformers.js` (ONNX MiniLM) in the lambda | ~90MB model against a 250MB bundle limit, and heavy cold starts on every function instance |
| Self-hosted Python FastAPI + sentence-transformers | Free-tier hosts sleep, producing ~50s cold starts; a second service to deploy and monitor for no accuracy gain |
| Open-weight LLM on a GPU host | Real cost, real ops, highest risk of not shipping |
| Pinecone / ChromaDB / FAISS | See [ADR-0002](0002-vector-storage.md) — pgvector is already in the database we're paying for |

## Environment variables

Added to `.env` and documented in `.env.example` (CC-00). **Keys go in `.env` only** — never in
source, never in a commit, never pasted into a chat or an issue.

```bash
# Embeddings — canonical model. Changing it requires a full backfill (see CC-10).
HF_API_TOKEN=
HF_EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
EMBEDDING_DIMENSIONS=384

# Generation — Groq primary, Mistral fallback
GROQ_API_KEY=
GROQ_MODEL=                 # verify current free-tier ID at implementation time
MISTRAL_API_KEY=
MISTRAL_MODEL=
MISTRAL_VISION_MODEL=

AI_ENABLED=true             # global kill switch — false disables all AI paths
```

> **Resolved 2026-09-20 by listing the live catalogues — and the caution was justified.**
> Groq's catalogue contained **no Llama chat models at all**; the ids this document would otherwise
> have guessed do not exist. Always list, never assume:
>
> ```
> curl -H "Authorization: Bearer $GROQ_API_KEY"    https://api.groq.com/openai/v1/models
> curl -H "Authorization: Bearer $MISTRAL_API_KEY" https://api.mistral.ai/v1/models
> ```
>
> | Role | Chosen | Verified |
> |---|---|---|
> | Generation (primary) | `openai/gpt-oss-120b` | chat 200 in 661ms; **tool calling works** |
> | Generation (fallback) | `mistral-small-latest` | listed with `function_calling` |
> | Vision (CC-50) | `mistral-medium-latest` | listed with `vision` |
>
> **`gpt-oss` is a reasoning model.** Its response carries a `reasoning` field alongside `content`,
> and reasoning tokens are drawn from the same `max_tokens` budget. A budget that is too small
> returns `content: ""` with `finish_reason: "stop"` — no error, no warning, just an empty answer.
> Consumers must budget generously and treat empty content as a failure rather than a valid reply.

**Key handling:** if a key is ever pasted somewhere shared, treat it as compromised and rotate it.
All three providers let you revoke and reissue for free, so rotation is cheap — do it on any doubt.
