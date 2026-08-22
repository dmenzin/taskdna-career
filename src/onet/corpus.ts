// Loader for the derived O*NET occupation corpus.
// Returns null when the corpus has not been built; callers must treat that as a
// BLOCKED state (or an explicitly labeled fallback fixture), never a silent pass.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { ONET_VERSION, type OnetCorpus, type OnetOccupationSkeleton } from "@/onet/types";

let cached: OnetCorpus | null | undefined;

export function corpusPath(root = process.cwd()) {
  return join(root, "data/derived/onet", ONET_VERSION, "occupation-corpus.json.gz");
}

export function loadOnetCorpus(root = process.cwd()): OnetCorpus | null {
  if (cached !== undefined) return cached;
  const path = corpusPath(root);
  if (!existsSync(path)) {
    cached = null;
    return cached;
  }
  const corpus = JSON.parse(gunzipSync(readFileSync(path)).toString("utf8")) as OnetCorpus;
  if (!Array.isArray(corpus.occupations) || corpus.occupations.length < 900) {
    throw new Error(`O*NET corpus at ${path} is malformed (${corpus.occupations?.length ?? 0} occupations)`);
  }
  cached = corpus;
  return cached;
}

export function requireOnetCorpus(root = process.cwd()): OnetCorpus {
  const corpus = loadOnetCorpus(root);
  if (!corpus) {
    throw new Error(
      "O*NET corpus not built. Run `pnpm onet:fetch && pnpm onet:verify && pnpm onet:build`. " +
        "O*NET-dependent gates are BLOCKED without it; the old O*NET-inspired snapshot is only a fallback test fixture.",
    );
  }
  return corpus;
}

export function occupationByCode(code: string, root = process.cwd()): OnetOccupationSkeleton | undefined {
  return loadOnetCorpus(root)?.occupations.find((occupation) => occupation.onetSocCode === code);
}
