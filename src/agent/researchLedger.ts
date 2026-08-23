// Projection of the architecture-evidence ledger. The JSON is the authority;
// docs/ARCHITECTURE_EVIDENCE_LEDGER.md is a generated view. This is not a second backlog.

export interface LedgerFinding {
  id: string;
  claim: string;
  strength: string;
  evidence: string[];
  doNotClaim: string;
}

export interface EvidenceLedger {
  version: string;
  purpose: string;
  authority: string;
  workingPrinciple: string;
  currentBaseline: {
    architecture: string;
    provider: string;
    model: string;
    effort: string;
    personPrompt: string;
    jobPrompt: string;
    matcher: string;
    corpus: string;
    split: string;
    productPath: string;
    asOf: string;
    pendingChange: string;
  };
  findings: LedgerFinding[];
  notYetKnown: string[];
}

export function renderLedger(ledger: EvidenceLedger): string {
  const lines: string[] = [];
  const w = (line = "") => lines.push(line);
  w("<!-- GENERATED FILE. Do not edit by hand. -->");
  w("<!-- Source: config/architecture-evidence-ledger.json -->");
  w("<!-- Regenerate: pnpm research:ledger -->");
  w();
  w("# Architecture evidence ledger");
  w();
  w(ledger.purpose);
  w();
  w(`**${ledger.authority}**`);
  w();
  w(`Working principle: ${ledger.workingPrinciple}`);
  w();
  w("## Current baseline");
  w();
  const b = ledger.currentBaseline;
  w(`- **Architecture:** ${b.architecture}`);
  w(`- **Provider / model / effort:** ${b.provider} / ${b.model} / ${b.effort}`);
  w(`- **Prompts:** person ${b.personPrompt}, job ${b.jobPrompt}`);
  w(`- **Matcher:** ${b.matcher}`);
  w(`- **Corpus / split:** ${b.corpus} / ${b.split}`);
  w(`- **As of:** ${b.asOf}`);
  w(`- **Product path:** ${b.productPath}`);
  w(`- **Pending change:** ${b.pendingChange}`);
  w();
  w("## Findings");
  w();
  for (const finding of ledger.findings) {
    w(`### \`${finding.id}\` — ${finding.strength}`);
    w();
    w(finding.claim);
    w();
    for (const row of finding.evidence) w(`- ${row}`);
    w();
    w(`**Do not claim:** ${finding.doNotClaim}`);
    w();
  }
  w("## Not yet known");
  w();
  for (const gap of ledger.notYetKnown) w(`- ${gap}`);
  w();
  return lines.join("\n") + "\n";
}
