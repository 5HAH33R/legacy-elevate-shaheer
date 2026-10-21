/**
 * Language of an owner's question (SPEC 5.8): English, Urdu (Arabic script)
 * or Roman Urdu. Deterministic and cheap, so the assistant can be told which
 * language to answer in and the saved message records it. A guess, not a
 * classifier: mixed questions fall back to whichever signal is stronger.
 */
export type AssistantLanguage = "en" | "ur" | "roman-ur";

export const LANGUAGE_LABELS: Record<AssistantLanguage, string> = {
  en: "English",
  ur: "Urdu",
  "roman-ur": "Roman Urdu",
};

const URDU_SCRIPT = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/g;

/** Common Roman Urdu words that are not also everyday English words. */
const ROMAN_URDU_WORDS = new Set([
  "kya", "kia", "hai", "hain", "hy", "ha", "mera", "meri", "mere", "kitna",
  "kitni", "kitne", "kaise", "kese", "kaisi", "kaisa", "hua", "hui", "huwa",
  "mahine", "mahina", "kon", "kaun", "konsi", "kaunsi", "ka", "ki", "ke", "ko",
  "nahi", "nahin", "hoon", "hun", "barha", "barhao", "sakta", "sakti", "sakte",
  "rahi", "raha", "rahe", "wala", "wali", "wale", "khatam", "hone", "aur",
  "bhi", "kab", "kahan", "kyun", "kyon", "batao", "bataen", "bataiye", "mujhe",
  "hum", "hamara", "hamari", "apni", "apna", "aaj", "kal", "hafte", "saal",
  "faida", "nuksan", "nuqsan", "kamai", "maal", "dukaan", "dukan", "bikri",
  "bechi", "becha", "kharcha", "kharche", "zyada", "ziada", "kam", "sab", "se",
]);

export function detectLanguage(text: string): AssistantLanguage {
  const letters = text.replace(/[\s\d\p{P}\p{S}]/gu, "");
  if (letters.length === 0) return "en";
  const urduChars = text.match(URDU_SCRIPT)?.length ?? 0;
  if (urduChars / letters.length >= 0.3) return "ur";

  const words = text.toLowerCase().match(/[a-z]+/g) ?? [];
  if (words.length === 0) return "en";
  const romanHits = words.filter((w) => ROMAN_URDU_WORDS.has(w)).length;
  // Two hits, or a third of a short question, is a strong Roman Urdu signal.
  return romanHits >= 2 || romanHits / words.length >= 0.34 ? "roman-ur" : "en";
}
