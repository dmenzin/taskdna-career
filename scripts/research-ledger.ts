// Generate docs/ARCHITECTURE_EVIDENCE_LEDGER.md from its authoritative data.
import { readFileSync, writeFileSync } from "node:fs";
import { renderLedger, type EvidenceLedger } from "../src/agent/researchLedger";

const ledger = JSON.parse(readFileSync("config/architecture-evidence-ledger.json", "utf8")) as EvidenceLedger;
writeFileSync("docs/ARCHITECTURE_EVIDENCE_LEDGER.md", renderLedger(ledger));
process.stdout.write(`wrote docs/ARCHITECTURE_EVIDENCE_LEDGER.md (${ledger.findings.length} findings)\n`);
