import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createDemoDataset } from "../src/domain/engine";

const outputPath = join(process.cwd(), "data", "sandbox-seed.json");
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, JSON.stringify(createDemoDataset(), null, 2));
console.log(`Seeded deterministic sandbox data at ${outputPath}`);
