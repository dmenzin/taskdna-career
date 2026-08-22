import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import "./seed";

const dbPath = join(process.cwd(), "data", "taskdna.sqlite");
if (existsSync(dbPath)) {
  rmSync(dbPath);
  console.log(`Removed local sandbox database at ${dbPath}`);
}
console.log("Reset complete. SQLite is represented by a swappable local data boundary in this V1 sandbox.");
