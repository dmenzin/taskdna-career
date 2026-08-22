// Verify previously fetched O*NET data against the committed manifest.
// Supports offline reuse: passes without network when local files match recorded hashes.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { ONET_VERSION, type OnetManifest } from "../src/onet/types";

const externalDir = join(process.cwd(), "data/external/onet", ONET_VERSION);
const manifestPath = join(process.cwd(), "data/manifests", `onet-${ONET_VERSION}.json`);

function fail(message: string): never {
  console.error(`O*NET verify FAILED: ${message}`);
  console.error("Run `pnpm onet:fetch` first. O*NET-dependent gates are BLOCKED until verification passes.");
  process.exit(1);
}

if (!existsSync(manifestPath)) fail(`Manifest not found at ${manifestPath}`);
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as OnetManifest;
if (manifest.version !== ONET_VERSION) fail(`Manifest version ${manifest.version} does not match expected ${ONET_VERSION}`);

const problems: string[] = [];
const archivePath = join(externalDir, manifest.archive.file);
if (!existsSync(archivePath)) {
  problems.push(`archive missing: ${manifest.archive.file}`);
} else if (createHash("sha256").update(readFileSync(archivePath)).digest("hex") !== manifest.archive.sha256) {
  problems.push(`archive checksum mismatch: ${manifest.archive.file}`);
}
for (const table of manifest.tables) {
  const path = join(externalDir, table.file);
  if (!existsSync(path)) {
    problems.push(`table missing: ${table.file}`);
    continue;
  }
  if (statSync(path).size !== table.bytes) {
    problems.push(`table size mismatch: ${table.file}`);
    continue;
  }
  const digest = createHash("sha256").update(readFileSync(path, "utf8")).digest("hex");
  if (digest !== table.sha256) problems.push(`table checksum mismatch: ${table.file}`);
}

if (problems.length) fail(problems.join("; "));
console.log(JSON.stringify({ ok: true, version: manifest.version, tables: manifest.tables.length, fetchedAt: manifest.fetchedAt, offlineReuse: true }, null, 2));
