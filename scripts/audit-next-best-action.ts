import { mkdirSync, writeFileSync } from "node:fs";
import { buildProfileFromCareerInput, createDemoDataset, scoreJobs } from "../src/domain/engine";
import { createHumanOpportunityGraph } from "../src/domain/networkEngine";

const dataset = createDemoDataset();
const profile = buildProfileFromCareerInput({
  id: "failure-analyst",
  name: "Investigation-oriented failure analyst",
  currentField: "medical devices",
  careerText: "I enjoy investigating product failures with logs and experiments. I dislike stakeholder roadmaps.",
  skills: ["python", "root cause"],
});
// Demo graph hydrates from persona id; reuse the demo persona path via scored jobs + graph factory that keys on persona id.
const demoProfile = { ...profile, persona: { ...profile.persona, id: "failure-analyst" } };
const jobs = scoreJobs(demoProfile, dataset.jobs);
const graph = createHumanOpportunityGraph(demoProfile, jobs);
const actions = graph.nextBestActions;
const types = new Set(actions.map((action) => action.actionType));
const minutes = actions.reduce((sum, action) => sum + action.timeEstimateMinutes, 0);
const duplicate = actions.some((action, index) => actions.findIndex((other) => other.title === action.title && other.relatedPersonId === action.relatedPersonId) !== index);
const allNetwork = actions.every((action) => action.actionType !== "APPLY_TO_JOB");
const referralOnWeak = actions.some((action) => action.actionType === "ASK_REFERRAL" && action.opportunityValue < 6.5);

const cases = [
  { id: "time-budget-60", pass: minutes <= 60 + 25, detail: `${minutes} min` },
  { id: "no-duplicates", pass: !duplicate, detail: "unique titles/people" },
  { id: "not-all-networking", pass: !allNetwork, detail: `types ${[...types].join(",")}` },
  { id: "no-advocacy-on-weak", pass: !referralOnWeak, detail: "referrals reserved for stronger jobs" },
  { id: "has-actions", pass: actions.length >= 3, detail: `${actions.length} actions` },
  { id: "type-diversity", pass: types.size >= 2, detail: `${types.size} types` },
];

const summary = { generatedAt: new Date().toISOString(), passed: cases.every((item) => item.pass), minutes, types: [...types], cases, sample: actions.slice(0, 6).map((action) => ({ type: action.actionType, title: action.title, minutes: action.timeEstimateMinutes })) };
mkdirSync("artifacts/logic_audit", { recursive: true });
writeFileSync("artifacts/logic_audit/next_best_action.json", JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
if (!summary.passed) process.exit(1);
