import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

export type LeakageClass =
  | "GENERIC_PRODUCT_LOGIC"
  | "CONFIGURABLE_DOMAIN_KNOWLEDGE"
  | "DEMO_OR_GOLDEN_FIXTURE"
  | "USER_SPECIFIC_STATE"
  | "PERSONALIZATION_LEAK_MUST_FIX";

export interface LeakageHit {
  file: string;
  line: number;
  snippet: string;
  pattern: string;
  classification: LeakageClass;
}

const ENGINE_PATHS = ["src/domain/engine.ts", "src/domain/networkEngine.ts"];
const FORBIDDEN_IN_ENGINE = [
  { pattern: 'persona.id === "', classification: "PERSONALIZATION_LEAK_MUST_FIX" as const },
  { pattern: "persona.id.includes", classification: "PERSONALIZATION_LEAK_MUST_FIX" as const },
  { pattern: "expectedHighFunctions.includes", classification: "PERSONALIZATION_LEAK_MUST_FIX" as const },
  { pattern: '=== "failure-analyst"', classification: "PERSONALIZATION_LEAK_MUST_FIX" as const },
  { pattern: '=== "low-information"', classification: "PERSONALIZATION_LEAK_MUST_FIX" as const },
];

const REPO_SCAN = [
  { pattern: "original design user", classification: "PERSONALIZATION_LEAK_MUST_FIX" as const },
  { pattern: "golden score", classification: "DEMO_OR_GOLDEN_FIXTURE" as const },
];

export function scanPersonalizationLeakage(root = process.cwd()): { hits: LeakageHit[]; mustFix: number } {
  const hits: LeakageHit[] = [];
  for (const file of ENGINE_PATHS) {
    hits.push(...scanFile(join(root, file), FORBIDDEN_IN_ENGINE, file));
  }
  hits.push(...walkScan(join(root, "src"), REPO_SCAN, root));
  const mustFix = hits.filter((hit) => hit.classification === "PERSONALIZATION_LEAK_MUST_FIX" && isEngineFile(hit.file)).length;
  return { hits, mustFix };
}

function isEngineFile(file: string) {
  return file.includes("src/domain/engine.ts") || file.includes("src/domain/networkEngine.ts");
}

function scanFile(abs: string, patterns: { pattern: string; classification: LeakageClass }[], rel: string): LeakageHit[] {
  let text = "";
  try {
    text = readFileSync(abs, "utf8");
  } catch {
    return [];
  }
  const hits: LeakageHit[] = [];
  const lines = text.split("\n");
  lines.forEach((line, index) => {
    for (const rule of patterns) {
      if (line.includes(rule.pattern)) {
        hits.push({ file: rel, line: index + 1, snippet: line.trim().slice(0, 180), pattern: rule.pattern, classification: rule.classification });
      }
    }
  });
  return hits;
}

function walkScan(dir: string, patterns: { pattern: string; classification: LeakageClass }[], root: string): LeakageHit[] {
  const hits: LeakageHit[] = [];
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    const stat = statSync(abs);
    if (stat.isDirectory() && entry !== "node_modules" && entry !== ".next") hits.push(...walkScan(abs, patterns, root));
    if (stat.isFile() && /\.(ts|tsx|md)$/.test(entry)) hits.push(...scanFile(abs, patterns, relative(root, abs)));
  }
  return hits;
}
