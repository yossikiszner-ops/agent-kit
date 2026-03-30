/**
 * bricks/tools/text-utils.js — Text analysis and transformation
 *
 * No API key required. Uses the AI model itself for language tasks.
 * This brick delegates back to the model for NLP-heavy operations,
 * keeping the brick as a structured interface.
 *
 * @type {import('@/core/types.js').Brick}
 */

import * as z from "zod";

const brick = {
  name: "text-utils",
  description:
    "Analyse and transform text. Actions: count words/chars/sentences, " +
    "extract keywords, detect language, check readability, or clean/format text. " +
    "For summarisation and translation, use the AI's own capabilities directly.",

  parameters: z.object({
    action: z
      .enum([
        "count",
        "keywords",
        "detect-language",
        "readability",
        "clean",
        "slug",
      ])
      .describe(
        "count=word/char/sentence stats, keywords=top keywords, " +
          "detect-language=identify the language, readability=reading level, " +
          "clean=strip extra whitespace/HTML, slug=convert to URL slug"
      ),
    text: z.string().min(1).max(50_000).describe("The text to process"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .describe("Max keywords to extract (default 10)"),
  }),

  execute: async ({ action, text, limit = 10 }) => {
    switch (action) {
      case "count": {
        const words = text
          .trim()
          .split(/\s+/)
          .filter((w) => w.length > 0);
        const sentences = text
          .split(/[.!?]+/)
          .filter((s) => s.trim().length > 0);
        const paragraphs = text
          .split(/\n\s*\n/)
          .filter((p) => p.trim().length > 0);
        const avgWordLength =
          words.reduce((sum, w) => sum + w.length, 0) / (words.length || 1);
        const readingTimeMinutes = Math.ceil(words.length / 200);

        return {
          characters: text.length,
          charactersNoSpaces: text.replace(/\s/g, "").length,
          words: words.length,
          sentences: sentences.length,
          paragraphs: paragraphs.length,
          avgWordLength: Math.round(avgWordLength * 100) / 100,
          readingTimeMinutes,
        };
      }

      case "keywords": {
        // Extract most frequent meaningful words
        const stopWords = new Set([
          "the", "a", "an", "and", "or", "but", "in", "on", "at", "to",
          "for", "of", "with", "by", "from", "is", "are", "was", "were",
          "be", "been", "being", "have", "has", "had", "do", "does", "did",
          "will", "would", "could", "should", "may", "might", "that", "this",
          "it", "its", "they", "them", "their", "we", "our", "you", "your",
          "i", "me", "my", "he", "she", "his", "her", "not", "no", "so",
        ]);

        const freq = new Map();
        text
          .toLowerCase()
          .replace(/[^a-z0-9\s'-]/g, " ")
          .split(/\s+/)
          .filter((w) => w.length > 3 && !stopWords.has(w))
          .forEach((w) => freq.set(w, (freq.get(w) ?? 0) + 1));

        const keywords = [...freq.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, limit)
          .map(([word, count]) => ({ word, count }));

        return { keywords, total: freq.size };
      }

      case "detect-language": {
        // Simple heuristic detection using character frequency patterns
        const sample = text.slice(0, 500).toLowerCase();
        const languages = detectLanguageHeuristic(sample);
        return { detected: languages[0], confidence: "heuristic", candidates: languages };
      }

      case "readability": {
        const words = text.trim().split(/\s+/).filter((w) => w.length > 0);
        const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
        const syllables = words.reduce((sum, w) => sum + countSyllables(w), 0);

        // Flesch-Kincaid Grade Level
        const wordsPerSentence = words.length / (sentences.length || 1);
        const syllablesPerWord = syllables / (words.length || 1);
        const fkGrade = 0.39 * wordsPerSentence + 11.8 * syllablesPerWord - 15.59;
        const grade = Math.max(1, Math.round(fkGrade));

        const levels = {
          1: "Very easy (Grade 1-2)",
          3: "Easy (Grade 3-4)",
          5: "Moderate (Grade 5-6)",
          7: "Standard (Grade 7-8)",
          9: "Fairly difficult (Grade 9-10)",
          11: "Difficult (Grade 11-12)",
          13: "Very difficult (College+)",
        };
        const label =
          Object.entries(levels)
            .reverse()
            .find(([g]) => grade >= Number(g))?.[1] ?? levels[1];

        return {
          gradeLevel: grade,
          label,
          wordsPerSentence: Math.round(wordsPerSentence * 10) / 10,
          syllablesPerWord: Math.round(syllablesPerWord * 100) / 100,
        };
      }

      case "clean": {
        const cleaned = text
          .replace(/<[^>]+>/g, " ") // strip HTML tags
          .replace(/\s+/g, " ") // collapse whitespace
          .replace(/\n{3,}/g, "\n\n") // max 2 blank lines
          .trim();
        return { original: text.length, cleaned, reduced: text.length - cleaned.length };
      }

      case "slug": {
        const slug = text
          .toLowerCase()
          .trim()
          .replace(/[^\w\s-]/g, "")
          .replace(/\s+/g, "-")
          .replace(/-+/g, "-")
          .slice(0, 100);
        return { slug };
      }

      default:
        return { error: `Unknown action: ${action}` };
    }
  },

  onError: (err) => `Text analysis failed: ${err.message}`,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** @param {string} word @returns {number} */
function countSyllables(word) {
  word = word.toLowerCase().replace(/[^a-z]/g, "");
  if (word.length <= 3) {
    return 1;
  }
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "");
  word = word.replace(/^y/, "");
  const matches = word.match(/[aeiouy]{1,2}/g);
  return Math.max(1, matches ? matches.length : 1);
}

/** @param {string} text @returns {string[]} */
function detectLanguageHeuristic(text) {
  const patterns = {
    Hindi: /[\u0900-\u097F]/,
    Chinese: /[\u4E00-\u9FFF]/,
    Japanese: /[\u3040-\u30FF]/,
    Korean: /[\uAC00-\uD7AF]/,
    Arabic: /[\u0600-\u06FF]/,
    Russian: /[\u0400-\u04FF]/,
  };
  for (const [lang, re] of Object.entries(patterns)) {
    if (re.test(text)) {
      return [lang, "English"];
    }
  }
  // Simple English vs Spanish/French/German heuristics
  if (/\b(the|and|that|have|for)\b/.test(text)) {
    return ["English", "Unknown"];
  }
  if (/\b(que|est|les|des|une)\b/.test(text)) {
    return ["French/Spanish", "Unknown"];
  }
  return ["Unknown"];
}

export default brick;
