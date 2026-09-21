/**
 * CC-23: HTML sanitisation.
 *
 * This is the whole security story of rich text. CC-22 explicitly refused to
 * go near user HTML because storing and rendering it is an XSS vulnerability
 * unless something strips it — so most of this file is attack payloads, and
 * the rest checks that legitimate formatting survives.
 */
import { describe, expect, it } from "vitest";
import {
  hasMath,
  prepareContent,
  sanitizeRichText,
  toPlainText,
} from "../../services/content/sanitize.js";

describe("what must never survive", () => {
  it("strips a script tag and its contents", () => {
    const out = sanitizeRichText('<p>hi</p><script>alert(1)</script>');

    expect(out).not.toContain("script");
    // Dropped entirely, not left as visible text.
    expect(out).not.toContain("alert(1)");
    expect(out).toContain("hi");
  });

  it("strips event handlers", () => {
    for (const payload of [
      '<img src=x onerror="alert(1)">',
      '<p onclick="alert(1)">click</p>',
      '<a href="https://x.com" onmouseover="alert(1)">link</a>',
      '<span onload="alert(1)">x</span>',
    ]) {
      const out = sanitizeRichText(payload);
      expect(out.toLowerCase()).not.toContain("onerror");
      expect(out.toLowerCase()).not.toContain("onclick");
      expect(out.toLowerCase()).not.toContain("onmouseover");
      expect(out.toLowerCase()).not.toContain("onload");
    }
  });

  it("strips javascript: and data: urls", () => {
    expect(sanitizeRichText('<a href="javascript:alert(1)">x</a>')).not.toContain(
      "javascript:",
    );
    expect(
      sanitizeRichText('<a href="data:text/html,<script>alert(1)</script>">x</a>'),
    ).not.toContain("data:");
  });

  it("strips style attributes", () => {
    const out = sanitizeRichText('<p style="position:fixed;top:0">x</p>');

    expect(out).not.toContain("style");
    expect(out).toContain("x");
  });

  it("strips iframe, object and embed", () => {
    for (const tag of ["iframe", "object", "embed"]) {
      const out = sanitizeRichText(`<${tag} src="https://evil.test"></${tag}>`);
      expect(out).not.toContain(tag);
    }
  });

  it("strips img entirely — inline images are CC-02's, not this spec's", () => {
    expect(sanitizeRichText('<img src="https://x.test/a.png">')).not.toContain(
      "img",
    );
  });

  it("strips form inputs", () => {
    const out = sanitizeRichText(
      '<form action="https://evil.test"><input name="password"></form>',
    );

    expect(out).not.toContain("form");
    expect(out).not.toContain("input");
  });

  it("handles malformed and nested payloads without leaking a tag", () => {
    for (const payload of [
      "<scr<script>ipt>alert(1)</script>",
      '<<SCRIPT>alert("XSS");//<</SCRIPT>',
      '<p><script>alert(1)</p></script>',
    ]) {
      expect(sanitizeRichText(payload).toLowerCase()).not.toContain("<script");
    }
  });

  it("is safe on non-string input", () => {
    expect(sanitizeRichText(null)).toBe("");
    expect(sanitizeRichText(undefined)).toBe("");
    expect(sanitizeRichText(42)).toBe("");
    expect(sanitizeRichText({ toString: () => "<script>" })).toBe("");
  });
});

describe("what must survive", () => {
  it("keeps ordinary formatting", () => {
    const out = sanitizeRichText(
      "<p><strong>bold</strong> and <em>italic</em></p>",
    );

    expect(out).toContain("<strong>bold</strong>");
    expect(out).toContain("<em>italic</em>");
  });

  it("keeps lists, headings and blockquotes", () => {
    const out = sanitizeRichText(
      "<h3>Tried</h3><ul><li>one</li><li>two</li></ul><blockquote>q</blockquote>",
    );

    expect(out).toContain("<h3>");
    expect(out).toContain("<li>one</li>");
    expect(out).toContain("<blockquote>");
  });

  it("keeps code and pre with their class", () => {
    const out = sanitizeRichText(
      '<pre class="language-python"><code class="language-python">x = 1</code></pre>',
    );

    expect(out).toContain("<pre");
    expect(out).toContain("language-python");
  });

  it("keeps KaTeX spans and their class", () => {
    const out = sanitizeRichText(
      '<span class="math-inline">\\frac{a}{b}</span>',
    );

    expect(out).toContain('class="math-inline"');
    expect(out).toContain("\\frac{a}{b}");
  });

  it("keeps an http link and hardens it", () => {
    const out = sanitizeRichText('<a href="https://docs.python.org">docs</a>');

    expect(out).toContain('href="https://docs.python.org"');
    // A doubt must not be able to reach back into the opener or leak referrer.
    expect(out).toContain('rel="noopener noreferrer nofollow"');
    expect(out).toContain('target="_blank"');
  });

  it("keeps mailto links", () => {
    expect(sanitizeRichText('<a href="mailto:a@b.edu">mail</a>')).toContain(
      "mailto:a@b.edu",
    );
  });
});

describe("prepareContent", () => {
  it("sanitises when the format is HTML", () => {
    const result = prepareContent("<p>ok</p><script>bad</script>", "HTML");

    expect(result.format).toBe("HTML");
    expect(result.value).not.toContain("script");
  });

  it("leaves plain text completely alone", () => {
    // The chatbot and the AI draft generator both write text programmatically
    // and know nothing about an editor.
    const raw = "if (a < b) { return true; }";
    const result = prepareContent(raw, undefined);

    expect(result.format).toBe("TEXT");
    expect(result.value).toBe(raw);
  });

  it("defaults to TEXT for an unknown format", () => {
    expect(prepareContent("x", "MARKDOWN").format).toBe("TEXT");
    expect(prepareContent("x", null).format).toBe("TEXT");
  });

  it("never returns the raw input for HTML", () => {
    const raw = '<img src=x onerror="alert(1)">';

    expect(prepareContent(raw, "HTML").value).not.toBe(raw);
  });
});

describe("toPlainText", () => {
  it("strips tags from HTML for embeddings and search", () => {
    // "<p>" is not what the doubt is about; leaving it shifts the vector for
    // no semantic reason.
    expect(
      toPlainText("<p>Why is my <strong>loop</strong> infinite?</p>", "HTML"),
    ).toBe("Why is my loop infinite?");
  });

  it("leaves plain text untouched, tags and all", () => {
    const raw = "compare a < b and b > c";

    expect(toPlainText(raw, "TEXT")).toBe(raw);
  });

  it("decodes the entities that matter", () => {
    expect(toPlainText("<p>a &amp; b</p>", "HTML")).toBe("a & b");
  });

  it("collapses whitespace from block markup", () => {
    expect(toPlainText("<p>one</p>\n\n<p>two</p>", "HTML")).toBe("one two");
  });

  it("is safe on empty input", () => {
    expect(toPlainText(null)).toBe("");
    expect(toPlainText(undefined, "HTML")).toBe("");
  });
});

describe("hasMath", () => {
  it("detects math so the client knows to load KaTeX", () => {
    expect(hasMath('<span class="math-inline">x</span>')).toBe(true);
    expect(hasMath('<span class="math-block">x</span>')).toBe(true);
  });

  it("is false for prose, so a reader downloads no typesetter", () => {
    expect(hasMath("<p>just words</p>")).toBe(false);
    expect(hasMath(null)).toBe(false);
  });
});
