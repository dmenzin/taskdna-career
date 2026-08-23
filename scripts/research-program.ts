// Generate docs/AGENTIC_RESEARCH_PROGRAM.md from its authoritative data.
//
// The data file is the authority; the Markdown is a projection. Ninety-four hand-maintained
// research documents is how a repository ends up needing archaeology instead of governance, so this
// one is not hand-maintained. `tests/research-program.test.ts` fails if the checked-in Markdown
// differs from what this script would produce, which makes drift a build failure rather than
// something discovered months later.
//
// Deterministic and free: reads two JSON files, writes one Markdown file.
import { readFileSync, writeFileSync } from "node:fs";
import { renderProgram, type Program, type Registry } from "../src/agent/researchProgramView";

const program = JSON.parse(readFileSync("config/agentic-research-program.json", "utf8")) as Program;
const registry = JSON.parse(readFileSync("config/experiment-registry.json", "utf8")) as Registry;

writeFileSync("docs/AGENTIC_RESEARCH_PROGRAM.md", renderProgram(program, registry));
process.stdout.write(`wrote docs/AGENTIC_RESEARCH_PROGRAM.md (${program.items.length} items, ${registry.records.length} experiments)\n`);
