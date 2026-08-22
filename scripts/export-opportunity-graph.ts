import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildUserProfile, createDemoDataset, scoreJobs } from "../src/domain/engine";
import { createHumanOpportunityGraph } from "../src/domain/networkEngine";

const artifactDir = join(process.cwd(), "artifacts");
mkdirSync(artifactDir, { recursive: true });

const profile = buildUserProfile("failure-analyst");
const dataset = createDemoDataset();
const scoredJobs = scoreJobs(profile, dataset.jobs);
const graph = createHumanOpportunityGraph(profile, scoredJobs);

writeFileSync(join(artifactDir, "demo_contacts.json"), JSON.stringify(graph.people, null, 2));
writeFileSync(join(artifactDir, "demo_relationships.json"), JSON.stringify(graph.relationships, null, 2));
writeFileSync(join(artifactDir, "demo_network_paths.json"), JSON.stringify(graph.paths, null, 2));
writeFileSync(join(artifactDir, "demo_interactions.json"), JSON.stringify(graph.interactions, null, 2));
writeFileSync(join(artifactDir, "demo_action_plan.json"), JSON.stringify(graph.nextBestActions, null, 2));

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>TaskDNA Human Opportunity Graph Demo</title>
  <style>
    body{margin:0;background:#f4f0e8;color:#16201d;font-family:Inter,system-ui,sans-serif}
    main{width:min(1280px,calc(100% - 28px));margin:0 auto;padding:28px 0}
    h1{font-size:clamp(2.4rem,6vw,5rem);letter-spacing:-.07em;line-height:.9;margin:0 0 12px}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.panel{background:#fffdf8;border:1px solid #ded6ca;border-radius:24px;padding:18px;box-shadow:0 18px 55px rgba(22,32,29,.1)}
    .list{display:grid;gap:10px}.item{border:1px solid #ded6ca;border-radius:18px;background:#fff;text-align:left;padding:12px}.scores{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
    .score{background:#f7f4ed;border-radius:14px;padding:10px}.score strong{display:block;font-size:1.4rem}.badge{display:inline-flex;margin:4px 5px 4px 0;padding:5px 9px;border-radius:999px;background:#efe8dc;font-size:.78rem;font-weight:800}
    @media(max-width:850px){.grid,.scores{grid-template-columns:1fr}}
  </style>
</head>
<body>
<main>
  <p><strong>DEMO DATA</strong> · simulated contacts · no sending or external integrations</p>
  <h1>Human Opportunity Graph</h1>
  <p>Self intelligence + job intelligence + network intelligence + human interaction strategy.</p>
  <section class="grid">
    <div class="panel">
      <h2>Today: Next Best Actions</h2>
      <div class="list" id="actions"></div>
    </div>
    <div class="panel">
      <h2>Top Contacts</h2>
      <div class="list" id="contacts"></div>
    </div>
    <div class="panel">
      <h2>Opportunity Access</h2>
      <div class="list" id="access"></div>
    </div>
    <div class="panel">
      <h2>Network Paths</h2>
      <div class="list" id="paths"></div>
    </div>
  </section>
</main>
<script>
const graph = ${JSON.stringify({
  actions: graph.nextBestActions.slice(0, 10),
  people: graph.people,
  relationships: graph.relationships,
  assessments: graph.contactAssessments,
  access: graph.accessAssessments.slice(0, 8),
  paths: graph.paths.slice(0, 12),
})};
function esc(value){ return String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
function pathLabel(pathType){ return pathType === "DIRECT" ? "Direct path" : pathType === "SECOND_DEGREE" ? "Second-degree path" : "Hypothetical path"; }
document.getElementById("actions").innerHTML = graph.actions.map(a => \`<div class="item"><strong>\${esc(a.title)}</strong><p>\${esc(a.whyNow)}</p><span class="badge">Priority \${a.priority.toFixed(1)}</span><span class="badge">Social cost \${a.socialCost.toFixed(1)}</span><span class="badge">\${esc(a.actionType.replaceAll("_"," "))}</span></div>\`).join("");
document.getElementById("contacts").innerHTML = graph.people.slice(0,12).map(p => { const r=graph.relationships.find(x=>x.personId===p.id); const a=graph.assessments.find(x=>x.personId===p.id); return \`<div class="item"><strong>\${esc(p.name)}</strong><p>\${esc(p.title)} · \${esc(r?.relationshipType.replaceAll("_"," ")||"")}</p><span class="badge">\${esc(p.functionalAreas[0])}</span><span class="badge">Routing \${a ? a.routingValue.toFixed(1) : "--"}</span><span class="badge">Credibility \${a ? a.credibilityValue.toFixed(1) : "--"}</span><span class="badge">\${esc(r?.preferredChannel||"")}</span></div>\`; }).join("");
document.getElementById("access").innerHTML = graph.access.map(a => \`<div class="item"><strong>\${esc(a.opportunityId)}</strong><div class="scores"><div class="score"><strong>\${a.informationAccess.toFixed(1)}</strong>Info</div><div class="score"><strong>\${a.routingAccess.toFixed(1)}</strong>Routing</div><div class="score"><strong>\${a.credibilityAccess.toFixed(1)}</strong>Cred</div><div class="score"><strong>\${a.referralAccess.toFixed(1)}</strong>Referral</div></div><p>\${esc(a.networkAccessSummary)}</p></div>\`).join("");
document.getElementById("paths").innerHTML = graph.paths.map(p => \`<div class="item"><strong>\${esc(pathLabel(p.pathType))}</strong><p>\${esc(p.explanation)}</p><span class="badge">Score \${p.pathScore.toFixed(1)}</span><span class="badge">\${esc(p.edgeCertainty)}</span><span class="badge">Hop \${p.hopCount}</span></div>\`).join("");
</script>
</body>
</html>`;

writeFileSync(join(artifactDir, "opportunity_graph_demo.html"), html);
console.log(`Exported opportunity graph demo artifacts to ${artifactDir}`);
