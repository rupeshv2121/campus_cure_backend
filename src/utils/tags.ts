/**
 * Tag normalization (CC-20).
 *
 * `Doubt.labels` holds what the author typed and is never rewritten.
 * `Doubt.labelsNormalized` holds a canonical form derived from it, and is what
 * filtering, counting and autocomplete match on. Three roles, and they never
 * swap: stored / matched / rendered.
 *
 * See docs/specs/CC-20-tags.md.
 */

export const MAX_TAGS_PER_DOUBT = 5;
export const MAX_TAG_LENGTH = 30;

/** Thrown for input a route should turn into a 400 rather than a 500. */
export class TagError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "TagError";
  }
}

/**
 * Canonical form of one tag, or null if nothing survives.
 *
 * `+`, `#` and `.` are kept because `c++`, `c#` and `node.js` are all tags a
 * student will actually type, and stripping them would silently merge C with
 * C++ — which is worse than any casing inconsistency this function fixes.
 *
 * Must stay in step with the backfill SQL in
 * prisma/migrations/20260921110000_cc20_add_doubt_labels_normalized.
 */
export const normalizeTag = (raw: unknown): string | null => {
  if (typeof raw !== "string") return null;

  const normalized = raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-+#.]/g, "");

  return normalized === "" ? null : normalized;
};

export interface PreparedTags {
  labels: string[];
  labelsNormalized: string[];
}

/**
 * The only function a write path may call.
 *
 * Returns both columns from one pass, same length and same order, so they
 * cannot drift. Deduplication is on the *normalized* form and the first casing
 * seen wins — `["Recursion", "recursion"]` is one tag, stored as the author
 * first wrote it.
 *
 * Throws rather than silently truncating: a student who typed six tags should
 * be told, not have the sixth quietly vanish.
 */
export const prepareTags = (raw: unknown): PreparedTags => {
  if (raw === undefined || raw === null) {
    return { labels: [], labelsNormalized: [] };
  }

  if (!Array.isArray(raw)) {
    throw new TagError("Tags must be a list.");
  }

  const labels: string[] = [];
  const labelsNormalized: string[] = [];
  const seen = new Set<string>();

  for (const entry of raw) {
    if (typeof entry !== "string") {
      throw new TagError("Each tag must be text.");
    }

    const trimmed = entry.trim();
    if (trimmed === "") continue;

    if (trimmed.length > MAX_TAG_LENGTH) {
      throw new TagError(
        `Tag "${trimmed.slice(0, MAX_TAG_LENGTH)}…" is longer than ${MAX_TAG_LENGTH} characters.`,
      );
    }

    const normalized = normalizeTag(trimmed);
    // Nothing usable survived — e.g. "!!!". Dropped, not an error: the student
    // gets the rest of their tags rather than a rejected form.
    if (!normalized || seen.has(normalized)) continue;

    seen.add(normalized);
    labels.push(trimmed);
    labelsNormalized.push(normalized);
  }

  if (labels.length > MAX_TAGS_PER_DOUBT) {
    throw new TagError(
      `At most ${MAX_TAGS_PER_DOUBT} tags are allowed (got ${labels.length}).`,
    );
  }

  return { labels, labelsNormalized };
};

/**
 * Normalize the `?tag=` query parameter.
 *
 * Express gives a string for one occurrence and an array for several. Both
 * sides of the comparison go through `normalizeTag`, which is what lets the
 * filter stay an exact GIN-indexed match instead of a raw case-insensitive
 * query.
 */
export const parseTagQuery = (raw: unknown): string[] => {
  const values = Array.isArray(raw) ? raw : raw === undefined ? [] : [raw];

  const normalized = values
    .map((value) => normalizeTag(value))
    .filter((value): value is string => value !== null);

  return [...new Set(normalized)];
};

export interface TagVocabularyEntry {
  /** Canonical key — what `?tag=` takes. */
  tag: string;
  /** Most common original casing — what every chip renders. */
  display: string;
  count: number;
}

/**
 * Pick the canonical display casing for each normalized tag.
 *
 * Modal casing, ties broken by whichever was seen most recently. This is what
 * makes `Recursion` and `recursion` look like one tag as well as match like
 * one — without rewriting either row.
 */
export const buildVocabulary = (
  rows: Array<{ labels: string[]; labelsNormalized: string[] }>,
): TagVocabularyEntry[] => {
  const counts = new Map<string, number>();
  const casings = new Map<string, Map<string, number>>();
  const lastSeen = new Map<string, number>();

  let ordinal = 0;

  for (const row of rows) {
    row.labelsNormalized.forEach((normalized, index) => {
      if (!normalized) return;

      counts.set(normalized, (counts.get(normalized) ?? 0) + 1);

      // Positionally aligned by prepareTags. A legacy row written before
      // CC-20 may not be, so fall back to the normalized form itself.
      const original = row.labels[index] ?? normalized;

      const byCasing = casings.get(normalized) ?? new Map<string, number>();
      byCasing.set(original, (byCasing.get(original) ?? 0) + 1);
      casings.set(normalized, byCasing);

      lastSeen.set(`${normalized}\u0000${original}`, ordinal++);
    });
  }

  return [...counts.entries()]
    .map(([tag, count]) => {
      const byCasing = casings.get(tag) ?? new Map<string, number>();

      let display = tag;
      let best = -1;
      let bestSeen = -1;

      for (const [casing, times] of byCasing) {
        const seen = lastSeen.get(`${tag}\u0000${casing}`) ?? -1;
        if (times > best || (times === best && seen > bestSeen)) {
          display = casing;
          best = times;
          bestSeen = seen;
        }
      }

      return { tag, display, count };
    })
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
};
