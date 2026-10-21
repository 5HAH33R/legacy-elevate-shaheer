import { describe, expect, it } from "vitest";
import { detectLanguage } from "./language";

describe("detectLanguage", () => {
  it.each([
    ["Mera profit kitna hua?", "roman-ur"],
    ["Kon si products ka stock khatam hone wala hai?", "roman-ur"],
    ["Is mahine meri sales kaisi rahi?", "roman-ur"],
    ["Main apni sales kaise barha sakta hoon?", "roman-ur"],
    ["میرا منافع کتنا ہوا؟", "ur"],
    ["اس مہینے میری سیلز کیسی رہیں؟", "ur"],
    ["What was my profit this month?", "en"],
    ["Which products are running low on stock?", "en"],
    ["How can I increase my sales?", "en"],
  ] as const)("%s → %s", (question, expected) => {
    expect(detectLanguage(question)).toBe(expected);
  });

  it("treats empty or symbol-only input as English", () => {
    expect(detectLanguage("")).toBe("en");
    expect(detectLanguage("??? 123")).toBe("en");
  });

  it("mostly-Urdu text with a product name in English is Urdu", () => {
    expect(detectLanguage("Flour کا اسٹاک کتنا باقی ہے؟")).toBe("ur");
  });
});
