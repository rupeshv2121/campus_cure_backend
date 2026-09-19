/**
 * The keyword retriever — the existing search, extracted verbatim.
 *
 * This is the BASELINE that CC-11 measures against. Its behaviour must not
 * change: weighted substring matching, 6 for an exact query in the title, 3 in
 * the description, 3 for a keyword in the title, 1 in the description,
 * filtered to score > 0.
 *
 * Do not "improve" this file. Improvements belong in the fusion layer, where
 * they can be measured. See docs/specs/CC-11-hybrid-search.md.
 */

const KEYWORD_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "how",
  "i",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "was",
  "what",
  "when",
  "where",
  "which",
  "why",
  "with",
]);

export const normalizeForKeywordMatch = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const extractKeywords = (value: string): string[] => {
  const normalized = normalizeForKeywordMatch(value);
  const tokens = normalized.split(" ").filter((token) => {
    return token.length >= 3 && !KEYWORD_STOP_WORDS.has(token);
  });

  return [...new Set(tokens)].slice(0, 8);
};

export interface KeywordCandidate {
  id: string;
  title: string;
  description: string;
}

export interface KeywordScore {
  id: string;
  score: number;
  matchedKeywords: string[];
}

/**
 * Score candidates against a query. Pure — the caller supplies the candidate
 * set, which keeps this testable and lets the evaluation harness run it
 * without a database.
 */
export const scoreByKeyword = <T extends KeywordCandidate>(
  query: string,
  candidates: T[],
): Array<T & KeywordScore> => {
  const normalizedQuery = normalizeForKeywordMatch(query);
  const keywords = extractKeywords(query);

  return candidates
    .map((candidate) => {
      const title = normalizeForKeywordMatch(candidate.title);
      const description = normalizeForKeywordMatch(candidate.description);

      let score = 0;
      if (title.includes(normalizedQuery)) score += 6;
      if (description.includes(normalizedQuery)) score += 3;

      const matchedKeywords = keywords.filter((keyword) => {
        const inTitle = title.includes(keyword);
        const inDescription = description.includes(keyword);

        if (inTitle) score += 3;
        else if (inDescription) score += 1;

        return inTitle || inDescription;
      });

      return { ...candidate, score, matchedKeywords };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score);
};

/** Ranked ids only, for fusion. */
export const keywordRank = <T extends KeywordCandidate>(
  query: string,
  candidates: T[],
): string[] => scoreByKeyword(query, candidates).map((c) => c.id);
