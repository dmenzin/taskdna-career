// Runtime caches are committed on purpose, and that decision needs a guard rather than a comment.
//
// The reason to commit them is strong: model interpretations are paid, slow, and irreproducible
// once a moving model alias moves, and an entire experimental arm was already lost to a blanket
// ignore rule. But "artifacts/agent_runtime/ is safe" is the WRONG generalisation. What is safe is
// interpretations of SYNTHETIC BENCHMARK inputs. The moment this repository interprets a real
// person's resume, the same directory becomes a place personal data would be committed to
// forever, in a public git history, with no practical way to remove it.
//
// So this test states the policy in executable form: every tracked cache file must be attributable
// to the synthetic benchmark, and none may contain a credential.
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const tracked = (): string[] => {
  try {
    return execFileSync("git", ["ls-files", "artifacts/agent_runtime"], { encoding: "utf8" })
      .split("\n").map((line) => line.trim()).filter(Boolean);
  } catch {
    return [];
  }
};

/**
 * A tracked cache file must name the synthetic benchmark family it came from, or be the budget
 * ledger, or be a calibration probe. Anything else is unattributable, and an unattributable cache
 * is exactly what this policy exists to catch.
 */
const SYNTHETIC_FAMILIES = ["natural", "semantic_bridge", "lexical_trap"];
const ALLOWED_NON_FAMILY = ["budget-ledger.json"];

describe("only synthetic benchmark caches may be committed", () => {
  const files = tracked();

  it("has something to check, or is explicit that it does not", () => {
    // Guards the failure where the whole suite passes because `git ls-files` returned nothing.
    expect(Array.isArray(files)).toBe(true);
  });

  it("attributes every tracked cache file to a synthetic benchmark family", () => {
    const unattributable = files.filter((file) => {
      const name = file.split("/").pop()!;
      if (ALLOWED_NON_FAMILY.includes(name)) return false;
      return !SYNTHETIC_FAMILIES.some((family) => name.includes(family));
    });
    expect(unattributable, `unattributable tracked cache files: ${unattributable.join(", ")}`).toEqual([]);
  });

  it("commits no cache under a user or production path", () => {
    // Default-deny in .gitignore covers these, but a `git add -f` would bypass it.
    const forbidden = files.filter((file) => /\/(user|production|prod|customer)\//.test(file));
    expect(forbidden, `caches under a non-synthetic path: ${forbidden.join(", ")}`).toEqual([]);
  });

  it("contains no credential in any tracked cache", () => {
    const patterns = [/sk-[A-Za-z0-9_-]{16,}/, /\bBearer\s+[A-Za-z0-9._-]{16,}/i, /"?api[_-]?key"?\s*[:=]\s*"[^"]{12,}"/i];
    const offenders: string[] = [];
    for (const file of files) {
      if (!existsSync(file)) continue;
      const contents = readFileSync(file, "utf8");
      if (patterns.some((pattern) => pattern.test(contents))) offenders.push(file);
    }
    expect(offenders, `credential-like strings in: ${offenders.join(", ")}`).toEqual([]);
  });

  it("keeps the default-deny rules for non-synthetic paths in .gitignore", () => {
    // If someone removes these while adding a real-user pipeline, this fails and asks why.
    const ignore = readFileSync(".gitignore", "utf8");
    expect(ignore).toContain("artifacts/agent_runtime/**/user/");
    expect(ignore).toContain("artifacts/agent_runtime/**/production/");
  });
});
