// Pure projection of the research-program data into Markdown.
//
// Separated from the script so a test can import it WITHOUT triggering a file write. The generator
// script previously did both, which meant importing it in a test silently regenerated the very
// file the test was checking -- a self-fulfilling assertion.
export interface ProgramItem {
  id: string; stage: string; question: string; status: string; dependencies: string[];
  evidenceSoFar: string; nextAction: string; successCriterion: string; split: string;
  estimatedCalls: number; estimatedCostUsd: number; latencyRelevance: string;
}
export interface Program {
  version: string; purpose: string; notDuplicated: string;
  statuses: Record<string, string>;
  stages: { id: string; name: string; exitCriterion: string }[];
  items: ProgramItem[];
}
export interface ExperimentRecord {
  experimentId: string;
  backfilled?: boolean;
  question?: string;
  hypothesis?: string;
  status: string;
  family: string;
  estimatedCalls: number | null;
  estimatedCostUsd: number | null;
  actualCalls: number | null;
  actualCostUsd: number | null;
  preregistrationCommit: string | null;
  resultArtifact: string | null;
  result: string;
  supersedes: string | null;
  supersededBy: string | null;
  [key: string]: unknown;
}

export interface Registry {
  version: string; purpose: string; immutabilityRule: string; backfillNote: string;
  records: ExperimentRecord[];
}

export function renderProgram(program: Program, registry: Registry): string {
  const lines: string[] = [];
  const w = (line = "") => lines.push(line);

  w("<!-- GENERATED FILE. Do not edit by hand. -->");
  w("<!-- Source: config/agentic-research-program.json + config/experiment-registry.json -->");
  w("<!-- Regenerate: pnpm research:program -->");
  w();
  w("# Agentic research program");
  w();
  w(program.purpose);
  w();
  w(`**${program.notDuplicated}**`);
  w();
  w("---");
  w();

  // Open questions grouped by stage, so dependency order is readable at a glance.
  w("## Open questions by stage");
  w();
  for (const stage of program.stages) {
    const items = program.items.filter((item) => item.stage === stage.id);
    w(`### ${stage.id} — ${stage.name}`);
    w();
    w(`**Exit criterion.** ${stage.exitCriterion}`);
    w();
    if (!items.length) {
      w("_No tracked items yet._");
      w();
      continue;
    }
    w("| id | status | question | depends on | next action | calls | cost |");
    w("| --- | --- | --- | --- | --- | --- | --- |");
    for (const item of items) {
      const deps = item.dependencies.length ? item.dependencies.join(", ") : "—";
      w(`| \`${item.id}\` | **${item.status}** | ${item.question} | ${deps} | ${item.nextAction} | ${item.estimatedCalls} | $${item.estimatedCostUsd.toFixed(2)} |`);
    }
    w();
  }

  // Detail, so evidence and success criteria are not lost to table truncation.
  w("---");
  w();
  w("## Item detail");
  w();
  for (const item of program.items) {
    w(`### \`${item.id}\` — ${item.question}`);
    w();
    w(`- **Status:** ${item.status} · **Stage:** ${item.stage} · **Split:** ${item.split}`);
    w(`- **Depends on:** ${item.dependencies.length ? item.dependencies.map((d) => `\`${d}\``).join(", ") : "nothing"}`);
    w(`- **Evidence so far:** ${item.evidenceSoFar}`);
    w(`- **Next action:** ${item.nextAction}`);
    w(`- **Success criterion:** ${item.successCriterion}`);
    w(`- **Cost if run:** ${item.estimatedCalls} calls, ~$${item.estimatedCostUsd.toFixed(2)}`);
    w(`- **Latency relevance:** ${item.latencyRelevance}`);
    w();
  }

  w("---");
  w();
  w("## Experiment ledger");
  w();
  w(registry.purpose);
  w();
  w(`**${registry.immutabilityRule}**`);
  w();
  w("| experiment | status | family | calls | cost | outcome |");
  w("| --- | --- | --- | --- | --- | --- |");
  for (const record of registry.records) {
    const superseded = record.supersededBy ? ` _(superseded by \`${record.supersededBy}\`)_` : "";
    w(`| \`${record.experimentId}\` | **${record.status}**${superseded} | ${record.family} | ${record.actualCalls ?? "—"} | ${record.actualCostUsd === null ? "—" : `$${record.actualCostUsd.toFixed(2)}`} | ${record.result} |`);
  }
  w();

  w("---");
  w();
  w("## Status vocabulary");
  w();
  w("Deliberately not binary pass/fail: most of these questions resolve into something other than a verdict.");
  w();
  w("| status | meaning |");
  w("| --- | --- |");
  for (const [status, meaning] of Object.entries(program.statuses)) w(`| \`${status}\` | ${meaning} |`);
  w();

  // A summary a human can scan without reading anything above it.
  const byStatus: Record<string, number> = {};
  for (const item of program.items) byStatus[item.status] = (byStatus[item.status] ?? 0) + 1;
  w("---");
  w();
  w("## At a glance");
  w();
  w(`- **${program.items.length}** tracked questions across **${program.stages.length}** stages`);
  w(`- Status spread: ${Object.entries(byStatus).sort().map(([s, n]) => `${n} ${s}`).join(", ")}`);
  const ready = program.items.filter((item) => item.status === "UNTESTED" && item.dependencies.length === 0);
  w(`- **Runnable now** (untested, no unmet dependency): ${ready.length ? ready.map((item) => `\`${item.id}\``).join(", ") : "none"}`);
  w(`- Total spend recorded so far: **$${registry.records.reduce((total, record) => total + (record.actualCostUsd ?? 0), 0).toFixed(2)}** across **${registry.records.reduce((total, record) => total + (record.actualCalls ?? 0), 0)}** calls`);
  w();

  return lines.join("\n") + "\n";
}

