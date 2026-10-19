import { describe, expect, it } from "vitest";
import {
  InvalidMoneyError,
  formatMoney,
  multiplyMoney,
  parseMoney,
  sumMoney,
} from "./money";

describe("parseMoney", () => {
  it("converts decimal strings to integer paisa", () => {
    expect(parseMoney("0")).toBe(0);
    expect(parseMoney("12")).toBe(1200);
    expect(parseMoney("12.5")).toBe(1250);
    expect(parseMoney("12.05")).toBe(1205);
    expect(parseMoney(" 1,250.50 ")).toBe(125050);
    expect(parseMoney("-3.10")).toBe(-310);
  });

  it("avoids floating-point rounding errors", () => {
    // 0.1 + 0.2 !== 0.3 in floating point; integer paisa stays exact.
    expect(parseMoney("0.10") + parseMoney("0.20")).toBe(parseMoney("0.30"));
  });

  it("rejects invalid input", () => {
    for (const bad of ["", "abc", "1.234", "1e3", "--1", "1.", ".5"]) {
      expect(() => parseMoney(bad)).toThrow(InvalidMoneyError);
    }
  });
});

describe("multiplyMoney and sumMoney", () => {
  it("keeps results as integers", () => {
    expect(multiplyMoney(1999, 3)).toBe(5997);
    expect(sumMoney([1999, 1, 5000])).toBe(7000);
    expect(sumMoney([])).toBe(0);
  });

  it("rejects fractional amounts and quantities", () => {
    expect(() => multiplyMoney(10.5, 2)).toThrow(RangeError);
    expect(() => multiplyMoney(100, 1.5)).toThrow(RangeError);
    expect(() => sumMoney([1, 0.5])).toThrow(RangeError);
  });
});

describe("formatMoney", () => {
  it("formats paisa as a PKR amount with two decimals", () => {
    const formatted = formatMoney(125050);
    expect(formatted).toContain("1,250.50");
    expect(formatted).toMatch(/Rs|PKR/);
  });

  it("formats zero and negative amounts", () => {
    expect(formatMoney(0)).toContain("0.00");
    expect(formatMoney(-310)).toMatch(/^-.*3\.10/);
  });
});
