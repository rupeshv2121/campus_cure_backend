/**
 * HTML sanitisation for user-authored posts (CC-23).
 *
 * Storing user HTML and rendering it is an XSS vulnerability unless something
 * strips it. CC-22 explicitly refused to go near HTML for that reason; this is
 * the module that makes it safe, and it is the only reason CC-23 is shippable.
 *
 * SANITISATION HAPPENS ON WRITE, ON THE SERVER. Not in the browser - the
 * editor is a convenience and POST accepts whatever a client sends. Not on
 * read - that leaves the dangerous string in the database, one forgotten
 * render away from executing.
 *
 * See docs/specs/CC-23-rich-text.md.
 */

import { ContentFormat } from "@prisma/client";
import sanitizeHtml from "sanitize-html";

/**
 * The allow-list.
 *
 * Everything not named here is dropped, which is the right default: a
 * deny-list is a promise to have thought of every attack, and nobody can make
 * that promise.
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p",
    "br",
    "strong",
    "em",
    "u",
    "s",
    "h2",
    "h3",
    "h4",
    "ul",
    "ol",
    "li",
    "blockquote",
    "code",
    "pre",
    "a",
    // KaTeX math and the code highlighter both need a plain span.
    "span",
  ],
  allowedAttributes: {
    // `rel` and `target` must be allowed here as well as set by
    // transformTags below: sanitize-html transforms first and filters
    // attributes second, so listing only `href` silently discards the
    // hardening the transform just added.
    a: ["href", "rel", "target"],
    // `class` only, and only where a renderer needs it. No `style`: it carries
    // expression(), url(javascript:) and layout attacks in old engines, and
    // buys nothing a class cannot.
    span: ["class"],
    code: ["class"],
    pre: ["class"],
  },
  // Anything else - data:, javascript:, vbscript: - is dropped with the
  // attribute.
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesAppliedToAttributes: ["href"],
  // A link in a doubt must not be able to reach back into the opener or leak
  // the referrer.
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", {
      rel: "noopener noreferrer nofollow",
      target: "_blank",
    }),
  },
  // Drop the contents too, rather than leaving the script body as visible
  // text.
  nonTextTags: ["style", "script", "textarea", "option", "noscript"],
};

/** Clean one HTML string. Always returns something safe to render. */
export const sanitizeRichText = (input: unknown): string => {
  if (typeof input !== "string") return "";

  return sanitizeHtml(input, OPTIONS).trim();
};

/**
 * Normalise what a client sent into a stored value and a format.
 *
 * The API accepts either format on purpose: the chatbot (CC-15) and the AI
 * draft generator (CC-12) both write answer text programmatically and know
 * nothing about an editor.
 */
export const prepareContent = (
  body: string,
  format: unknown,
): { value: string; format: ContentFormat } => {
  if (format === ContentFormat.HTML || format === "HTML") {
    return { value: sanitizeRichText(body), format: ContentFormat.HTML };
  }

  return { value: typeof body === "string" ? body : "", format: ContentFormat.TEXT };
};

/**
 * Strip tags down to readable text.
 *
 * Applied where the text is CONSUMED rather than where it is stored: CC-10's
 * embeddings and CC-11's search both read these columns directly, and HTML
 * tags in an embedding input are noise that shifts the vector for no semantic
 * reason.
 */
export const toPlainText = (
  body: string | null | undefined,
  format?: ContentFormat | null,
): string => {
  if (!body) return "";
  if (format !== ContentFormat.HTML) return body;

  const stripped = sanitizeHtml(body, { allowedTags: [], allowedAttributes: {} });

  // sanitize-html escapes entities on the way out; decode the handful that
  // matter so an embedding sees "a & b" rather than "a &amp; b".
  return stripped
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
};

/** True when a post carries math, so the client knows to load KaTeX. */
export const hasMath = (body: string | null | undefined): boolean =>
  Boolean(body && /class="math-(inline|block)"/.test(body));
