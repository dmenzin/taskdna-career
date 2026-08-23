import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { SECRET_PATTERN_SOURCE, SECRET_SCAN_ALLOWLIST, unexpectedSecretMatches } from "@/agent/secretScan";

describe("secret-scan allowlist does not weaken the scanner", () => {
  it("still flags a live-looking key outside the allowlist", () => {
    expect(unexpectedSecretMatches(["src/app/page.tsx", "tests/openai-provider.test.ts"])).toEqual(["src/app/page.tsx"]);
  });

  it("keeps the allowlist tiny and named", () => {
    expect(SECRET_SCAN_ALLOWLIST).toEqual(["tests/openai-provider.test.ts"]);
  });

  it("only allowlists a file that actually contains the hygiene fixture", () => {
    const source = readFileSync("tests/openai-provider.test.ts", "utf8");
    expect(source).toContain("sk-test-SENTINEL-must-never-appear");
    expect(new RegExp(SECRET_PATTERN_SOURCE).test(source)).toBe(true);
  });

  it("uses the same pattern the readiness script greps for", () => {
    const readiness = readFileSync("scripts/iteration-readiness.ts", "utf8");
    expect(readiness).toContain("unexpectedSecretMatches");
    expect(readiness).toContain('["(AK"');
  });
});
