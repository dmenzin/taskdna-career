import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildUserProfile, createDemoDataset, scoreFunctions, scoreJobs } from "../src/domain/engine";

const artifactDir = join(process.cwd(), "artifacts");
mkdirSync(artifactDir, { recursive: true });

const dataset = createDemoDataset();
const profile = buildUserProfile("failure-analyst");
const functions = scoreFunctions(profile);
const jobs = scoreJobs(profile, dataset.jobs);

writeFileSync(join(artifactDir, "demo_jobs.json"), JSON.stringify(jobs, null, 2));
writeFileSync(join(artifactDir, "demo_functions.json"), JSON.stringify(functions, null, 2));
writeFileSync(join(artifactDir, "demo_personas.json"), JSON.stringify(dataset.personas, null, 2));

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>TaskDNA Function Map Demo</title>
  <style>
    body{margin:0;background:#f4f0e8;color:#16201d;font-family:Inter,system-ui,sans-serif}
    main{width:min(1280px,calc(100% - 28px));margin:0 auto;padding:28px 0}
    h1{font-size:clamp(2.4rem,6vw,5.4rem);letter-spacing:-.07em;line-height:.9;margin:0 0 12px}
    .panel,.detail{background:#fffdf8;border:1px solid #ded6ca;border-radius:24px;box-shadow:0 18px 55px rgba(22,32,29,.1);padding:20px}
    .controls{display:flex;gap:10px;flex-wrap:wrap;margin:18px 0}.controls>*{min-height:42px;border-radius:999px;border:1px solid #ded6ca;background:#fff;padding:0 12px}
    .layout{display:grid;grid-template-columns:360px 1fr;gap:16px}.list{display:grid;gap:10px;max-height:720px;overflow:auto}
    button.job{border:1px solid #ded6ca;border-radius:18px;background:#fff;text-align:left;padding:14px;cursor:pointer}.job.active{outline:3px solid rgba(31,111,91,.18);border-color:#1f6f5b}
    .scores{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:16px 0}.score{background:#f7f4ed;border-radius:16px;padding:12px}.score strong{display:block;font-size:1.6rem}
    .badge{display:inline-flex;margin:4px 6px 4px 0;padding:6px 10px;border-radius:999px;background:#efe8dc;font-size:.78rem;font-weight:800}.spark{background:#ffe8b8}
    @media(max-width:850px){.layout,.scores{grid-template-columns:1fr}}
  </style>
</head>
<body>
<main>
  <p><strong>DEMO DATA</strong> · heuristic recommendations · no live market availability implied</p>
  <h1>TaskDNA function map demo</h1>
  <p>Standalone export with seeded jobs, function filtering, search, sorting, saved state, explanations, novelty, freshness, and action tiers.</p>
  <section class="panel">
    <div class="controls">
      <input id="search" placeholder="Search jobs, functions, skills, gaps" />
      <select id="function">${["<option value=''>All functions</option>", ...functions.map((item) => `<option value="${item.function.id}">${item.function.shortName}</option>`)].join("")}</select>
      <select id="sort"><option value="overall">Overall</option><option value="fit">Work Fit</option><option value="hireability">Hireability</option><option value="novelty">Novelty</option></select>
      <button id="savedOnly">Saved only</button>
    </div>
    <div class="layout">
      <div class="list" id="list"></div>
      <article class="detail" id="detail"></article>
    </div>
  </section>
</main>
<script>
const jobs = ${JSON.stringify(jobs.slice(0, 90))};
let selected = jobs[0]?.job.canonicalId;
let saved = new Set(JSON.parse(localStorage.getItem("taskdna-saved") || "[]"));
let savedOnly = false;
const list = document.getElementById("list");
const detail = document.getElementById("detail");
function filtered(){
  const q = document.getElementById("search").value.toLowerCase();
  const f = document.getElementById("function").value;
  const s = document.getElementById("sort").value;
  return jobs.filter(j => (!f || j.analysis.primaryFunctionId === f) && (!savedOnly || saved.has(j.job.canonicalId)) && [j.job.title,j.job.company,j.job.domain,j.analysis.whatThisJobIsReallyAbout,j.analysis.requiredCapabilities.join(" "),j.analysis.frictionFactors.join(" ")].join(" ").toLowerCase().includes(q))
    .sort((a,b)=> s==="fit" ? b.score.predictedFit-a.score.predictedFit : s==="hireability" ? b.score.hireability-a.score.hireability : s==="novelty" ? b.score.novelty-a.score.novelty : b.score.overall-a.score.overall);
}
function render(){
  const rows = filtered();
  if (!rows.some(r => r.job.canonicalId === selected)) selected = rows[0]?.job.canonicalId;
  list.innerHTML = rows.map(j => \`<button class="job \${j.job.canonicalId===selected ? "active" : ""}" data-id="\${j.job.canonicalId}"><strong>\${j.job.title}</strong><br><span>\${j.job.company} · \${j.job.workMode}</span><p>\${j.analysis.whatThisJobIsReallyAbout}</p><span class="badge">Fit \${j.score.predictedFit.toFixed(1)}</span><span class="badge">Hire \${j.score.hireability.toFixed(1)}</span>\${j.score.novelty>=7.5?'<span class="badge spark">Non-obvious</span>':''}</button>\`).join("");
  list.querySelectorAll("button").forEach(btn => btn.onclick = () => { selected = btn.dataset.id; render(); });
  const j = rows.find(r => r.job.canonicalId === selected);
  detail.innerHTML = j ? \`<p><strong>\${j.job.freshnessState.replaceAll("_"," ")}</strong> · DEMO DATA</p><h2>\${j.job.title}</h2><p>\${j.job.company} · \${j.job.location} · \${j.job.compensation}</p><div class="scores"><div class="score"><strong>\${j.score.predictedFit.toFixed(1)}</strong>Work Fit</div><div class="score"><strong>\${j.score.hireability.toFixed(1)}</strong>Hireability</div><div class="score"><strong>\${j.score.careerDirection.toFixed(1)}</strong>Direction</div><div class="score"><strong>\${j.score.novelty.toFixed(1)}</strong>Novelty</div></div><h3>Actual work</h3><p>\${j.analysis.whatThisJobIsReallyAbout}</p><h3>Why / friction / gaps</h3><ul>\${[...j.analysis.strongMatchFactors,...j.analysis.frictionFactors,...(j.analysis.hardGaps.length?j.analysis.hardGaps:["No fatal core gap"])].map(x=>\`<li>\${x}</li>\`).join("")}</ul><p><span class="badge">\${j.score.actionTier.replaceAll("_"," ")}</span><span class="badge">\${j.score.sellability.replaceAll("_"," ")}</span></p><button id="save"> \${saved.has(j.job.canonicalId) ? "Unsave" : "Save"} </button><h3>Decision trace</h3><ol>\${j.decisionTrace.map(x=>\`<li>\${x}</li>\`).join("")}</ol>\` : "<p>No matches.</p>";
  const save = document.getElementById("save");
  if (save && j) save.onclick = () => { saved.has(j.job.canonicalId) ? saved.delete(j.job.canonicalId) : saved.add(j.job.canonicalId); localStorage.setItem("taskdna-saved", JSON.stringify([...saved])); render(); };
}
["search","function","sort"].forEach(id => document.getElementById(id).addEventListener("input", render));
document.getElementById("savedOnly").onclick = () => { savedOnly = !savedOnly; render(); };
render();
</script>
</body>
</html>`;

writeFileSync(join(artifactDir, "function_map_demo.html"), html);
console.log(`Exported standalone demo artifacts to ${artifactDir}`);
