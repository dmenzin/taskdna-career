// Reproducible fetch of the official O*NET 30.3 downloadable database (CSV form).
// Idempotent: reuses a previously downloaded archive when its checksum still matches.
// Fails loudly when expected tables are missing or unreadable.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseCsvTable } from "../src/onet/csv";
import { ONET_CONSUMED_TABLES, ONET_LICENSE, ONET_SOURCE_URL, ONET_TRANSFORM_VERSION, ONET_VERSION, type OnetManifest } from "../src/onet/types";

const externalDir = join(process.cwd(), "data/external/onet", ONET_VERSION);
const manifestPath = join(process.cwd(), "data/manifests", `onet-${ONET_VERSION}.json`);
const archivePath = join(externalDir, "db_30_3_csv.zip");
const csvDir = join(externalDir, "db_30_3_csv");
const force = process.argv.includes("--force");

function sha256(path: string) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

async function download() {
  mkdirSync(externalDir, { recursive: true });
  if (existsSync(archivePath) && !force) {
    console.log(`Archive already present at ${archivePath}; reusing (pass --force to re-download).`);
    return;
  }
  console.log(`Downloading ${ONET_SOURCE_URL} ...`);
  const response = await fetch(ONET_SOURCE_URL);
  if (!response.ok) throw new Error(`Download failed: HTTP ${response.status} ${response.statusText}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 1_000_000) throw new Error(`Downloaded archive is implausibly small (${bytes.length} bytes); refusing to continue.`);
  writeFileSync(archivePath, bytes);
  console.log(`Downloaded ${bytes.length} bytes.`);
}

function extract() {
  console.log("Extracting archive ...");
  execFileSync("unzip", ["-oq", archivePath, "-d", externalDir], { stdio: "inherit" });
  if (!existsSync(csvDir)) throw new Error(`Extraction did not produce ${csvDir}`);
}

function verifyAndManifest(): OnetManifest {
  const tables: OnetManifest["tables"] = [];
  for (const table of ONET_CONSUMED_TABLES) {
    const file = join(csvDir, `${table}.csv`);
    if (!existsSync(file)) throw new Error(`Expected O*NET table missing after extraction: ${table}.csv`);
    const text = readFileSync(file, "utf8");
    // Parse headers now so malformed data fails at fetch time, not deep inside the corpus build.
    const parsed = parseCsvTable(text);
    if (parsed.rows.length === 0) throw new Error(`O*NET table ${table}.csv contains no data rows`);
    tables.push({
      table,
      file: `db_30_3_csv/${table}.csv`,
      sha256: createHash("sha256").update(text).digest("hex"),
      bytes: statSync(file).size,
      rows: parsed.rows.length,
    });
  }
  const manifest: OnetManifest = {
    version: ONET_VERSION,
    sourceUrl: ONET_SOURCE_URL,
    fetchedAt: new Date().toISOString(),
    license: ONET_LICENSE,
    archive: { file: "db_30_3_csv.zip", sha256: sha256(archivePath), bytes: statSync(archivePath).size },
    tables,
    transformVersion: ONET_TRANSFORM_VERSION,
  };
  mkdirSync(join(process.cwd(), "data/manifests"), { recursive: true });
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  return manifest;
}

async function main() {
  await download();
  extract();
  const manifest = verifyAndManifest();
  console.log(JSON.stringify({
    ok: true,
    version: manifest.version,
    archiveSha256: manifest.archive.sha256,
    tables: manifest.tables.length,
    totalRows: manifest.tables.reduce((sum, table) => sum + table.rows, 0),
    manifest: manifestPath,
  }, null, 2));
}

main().catch((error) => {
  console.error(`O*NET fetch FAILED: ${error instanceof Error ? error.message : String(error)}`);
  console.error("Do NOT fall back silently to the O*NET-inspired snapshot. O*NET-dependent gates are BLOCKED until this succeeds.");
  process.exit(1);
});
