"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Beaker, BrainCircuit, Bug, FlaskConical, Heart, Search, Sparkles, Target, TrendingUp } from "lucide-react";
import { careerFunctions, dimensions } from "@/config/model";
import { applyFeedback, applyScenarioResponses, buildUserProfile, createDemoDataset, filterAndSortJobs, scoreFunctions, scoreJobs, selectAdaptiveScenarios } from "@/domain/engine";
import type { FeedbackEvent, Reaction, ScoredJob } from "@/domain/types";

const demo = createDemoDataset();

export default function Home() {
  const [personaId, setPersonaId] = useState("failure-analyst");
  const [careerText, setCareerText] = useState("");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [functionId, setFunctionId] = useState("");
  const [sortKey, setSortKey] = useState("overall");
  const [freshnessFilter, setFreshnessFilter] = useState("");
  const [noveltyOnly, setNoveltyOnly] = useState(false);
  const [saved, setSaved] = useState<string[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [feedbackLog, setFeedbackLog] = useState<string[]>([]);
  const [answeredScenarioIds, setAnsweredScenarioIds] = useState<string[]>([]);
  const [profileOverride, setProfileOverride] = useState<ReturnType<typeof buildUserProfile> | null>(null);

  const profile = useMemo(() => profileOverride ?? buildUserProfile(personaId, careerText || undefined), [careerText, personaId, profileOverride]);
  const functionScores = useMemo(() => scoreFunctions(profile), [profile]);
  const scoredJobs = useMemo(() => scoreJobs(profile, demo.jobs).filter((item) => !dismissed.includes(item.job.canonicalId)), [profile, dismissed]);
  const interviewPlan = useMemo(() => selectAdaptiveScenarios(profile, answeredScenarioIds, 3), [profile, answeredScenarioIds]);
  const visibleJobs = useMemo(() => filterAndSortJobs(scoredJobs, query, functionId, sortKey, noveltyOnly).filter((item) => !freshnessFilter || item.job.freshnessState === freshnessFilter), [scoredJobs, query, functionId, sortKey, noveltyOnly, freshnessFilter]);
  const selectedJob = visibleJobs.find((item) => item.job.canonicalId === selectedJobId) ?? visibleJobs[0];

  function choosePersona(nextPersonaId: string) {
    setPersonaId(nextPersonaId);
    setCareerText("");
    setProfileOverride(null);
    setSelectedJobId(null);
    setDismissed([]);
    setSaved([]);
    setFeedbackLog([]);
    setAnsweredScenarioIds([]);
    setFreshnessFilter("");
  }

  function reactToJob(job: ScoredJob, reaction: Reaction, reasonTags: string[]) {
    const event: FeedbackEvent = { jobId: job.job.canonicalId, reaction, reasonTags };
    const result = applyFeedback(profile, scoredJobs, event);
    setProfileOverride(result.updatedProfile);
    setFeedbackLog((items) => [`${reaction} on ${job.job.title}: ${result.explanation}`, ...items].slice(0, 5));
  }

  function answerScenario(scenarioId: string, answer: "LOVE" | "DISLIKE" | "INTERESTING") {
    const result = applyScenarioResponses(profile, [{ scenarioId, answer, confidence: 0.78 }]);
    setProfileOverride(result.updatedProfile);
    setAnsweredScenarioIds((items) => [...items, scenarioId]);
  }

  return (
    <main>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Sandbox prototype · Synthetic demo data · No external credentials</p>
          <h1>Find work by the structure of the day, not the title on the posting.</h1>
          <p className="lede">
            TaskDNA infers what kind of problems energize you, separates preference from demonstrated capability, then ranks jobs by work fit, hireability, direction, novelty, and friction.
          </p>
          <div className="hero-actions">
            <a href="#job-explorer" className="button primary">Try demo <ArrowRight size={16} /></a>
            <a href="#debug" className="button">Open decision trace</a>
          </div>
        </div>
        <div className="hero-panel">
          <Metric icon={<Heart />} label="Work Fit" value={selectedJob ? selectedJob.score.predictedFit.toFixed(1) : "--"} />
          <Metric icon={<Target />} label="Hireability Today" value={selectedJob ? selectedJob.score.hireability.toFixed(1) : "--"} />
          <Metric icon={<TrendingUp />} label="Career Direction" value={selectedJob ? selectedJob.score.careerDirection.toFixed(1) : "--"} />
          <p className="small">Magic moment: “I would never have searched for this title, but the actual work sounds exactly like me.”</p>
        </div>
      </section>

      <section className="card-grid onboarding" aria-labelledby="onboarding-title" data-testid="onboarding">
        <div className="card span-2">
          <h2 id="onboarding-title">Start with demo or career input</h2>
          <div className="persona-grid">
            {demo.personas.map((persona) => (
              <button key={persona.id} data-testid={`persona-${persona.id}`} className={persona.id === personaId ? "persona active" : "persona"} onClick={() => choosePersona(persona.id)}>
                <strong>{persona.name}</strong>
                <span>{persona.summary}</span>
              </button>
            ))}
          </div>
          <label className="input-label" htmlFor="career-text">Paste resume/career text (optional)</label>
          <textarea
            id="career-text"
            value={careerText}
            onChange={(event) => {
              setCareerText(event.target.value);
              setProfileOverride(null);
            }}
            placeholder={profile.persona.careerText}
          />
        </div>
        <div className="card">
          <h3>Structured evidence</h3>
          <p>{profile.evidence.length} evidence records with provenance, source type, capability signals, enjoyment, dislikes, recency, and reliability.</p>
          {profile.evidence.slice(0, 3).map((item) => (
            <div className="evidence" key={item.id}>
              <span>{item.sourceType}</span>
              <p>{item.originalText}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="card-grid" id="profile" data-testid="profile">
        <div className="card">
          <h2><BrainCircuit size={22} /> Task DNA profile</h2>
          <p className="muted">Confidence: {Math.round(profile.confidence * 100)}%. Inferences are heuristic, not psychometric claims.</p>
          <div className="dimension-list">
            {profile.taskDna
              .slice()
              .sort((a, b) => b.value * b.confidence - a.value * a.confidence)
              .slice(0, 8)
              .map((item) => {
                const definition = dimensions.find((dimension) => dimension.id === item.dimensionId);
                return (
                  <div className="dimension" key={item.dimensionId}>
                    <div><strong>{definition?.consumerLabel}</strong><span>{item.interpretation}</span></div>
                    <progress value={item.value} max={10} />
                    <small>{item.value.toFixed(1)} · confidence {Math.round(item.confidence * 100)}%</small>
                  </div>
                );
              })}
          </div>
        </div>
        <div className="card">
          <h2>Capabilities are separate</h2>
          <p className="muted">Preference feedback never fabricates capability evidence.</p>
          <div className="pill-list">
            {profile.capabilities.map((capability) => (
              <span className="pill" key={capability.id}>{capability.name} · {capability.evidenceLevel.replaceAll("_", " ")}</span>
            ))}
          </div>
          <h3>Contradictions / uncertainty</h3>
          <ul>
            {(profile.contradictions.length ? profile.contradictions : ["No strong contradiction detected in this fixture."]).map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      </section>

      <section className="card" id="interview" data-testid="adaptive-interview">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Adaptive scenario interview</p>
            <h2>Clarify uncertain work preferences</h2>
          </div>
          <span className="pill">{interviewPlan.earlyStopped ? "Early stopped" : `${interviewPlan.scenarios.length} next scenarios`}</span>
        </div>
        <p className="muted">{interviewPlan.rationale.join(" ")}</p>
        <div className="scenario-grid">
          {interviewPlan.scenarios.length ? interviewPlan.scenarios.map((scenario) => (
            <article className="scenario-card" key={scenario.id}>
              <strong>{scenario.title}</strong>
              <p>{scenario.prompt}</p>
              <small>Targets: {scenario.targetDimensions.join(", ")}</small>
              <div className="reaction-row">
                <button data-testid={`scenario-love-${scenario.id}`} onClick={() => answerScenario(scenario.id, "LOVE")}>Love this</button>
                <button onClick={() => answerScenario(scenario.id, "INTERESTING")}>Interesting</button>
                <button onClick={() => answerScenario(scenario.id, "DISLIKE")}>Dislike this</button>
              </div>
            </article>
          )) : <p>The profile has enough confidence for now. You can still refine it by reacting to jobs.</p>}
        </div>
      </section>

      <section className="card" id="functions" data-testid="functions">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Work functions, not titles</p>
            <h2>Ranked function map</h2>
          </div>
          <button className="button" onClick={() => setFunctionId("")}>Clear function filter</button>
        </div>
        <div className="function-grid">
          {functionScores.slice(0, 8).map((item, index) => (
            <button key={item.function.id} className={functionId === item.function.id ? "function-card active" : "function-card"} onClick={() => setFunctionId(item.function.id)}>
              <span>#{index + 1}</span>
              <strong>{item.function.name}</strong>
              <p>{item.function.oneSentenceTaskLoop}</p>
              <div className="score-row">
                <Score label="Fit" value={item.predictedFit} />
                <Score label="Hire" value={item.hireability} />
                <Score label="Dir" value={item.careerDirection} />
              </div>
              <small>Likely friction: {item.function.commonRepellents.slice(0, 2).join(", ")}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="explorer" id="job-explorer" data-testid="job-explorer">
        <div className="explorer-header">
          <div>
            <p className="eyebrow">Job explorer</p>
            <h2>Ranked synthetic jobs</h2>
          </div>
          <div className="controls">
            <label><Search size={16} /> <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, work, skills, gaps..." /></label>
            <select value={functionId} onChange={(event) => setFunctionId(event.target.value)} aria-label="Filter by function">
              <option value="">All functions</option>
              {careerFunctions.map((fn) => <option value={fn.id} key={fn.id}>{fn.shortName}</option>)}
            </select>
            <select value={sortKey} onChange={(event) => setSortKey(event.target.value)} aria-label="Sort jobs">
              <option value="overall">Overall priority</option>
              <option value="fit">Work Fit</option>
              <option value="hireability">Hireability</option>
              <option value="direction">Career Direction</option>
              <option value="confidence">Confidence</option>
              <option value="novelty">Novelty</option>
              <option value="company">Company A-Z</option>
            </select>
            <select value={freshnessFilter} onChange={(event) => setFreshnessFilter(event.target.value)} aria-label="Filter by freshness" data-testid="freshness-filter">
              <option value="">All freshness states</option>
              <option value="VERIFIED_LIVE">Verified live</option>
              <option value="REVERIFIED_LIVE">Reverified live</option>
              <option value="PREVIOUSLY_FOUND_NOT_RECHECKED">Previously found</option>
              <option value="POSSIBLY_STALE">Possibly stale</option>
              <option value="CONFIRMED_CLOSED">Confirmed closed</option>
            </select>
            <button className={noveltyOnly ? "button primary" : "button"} onClick={() => setNoveltyOnly((value) => !value)}>Non-obvious only</button>
          </div>
        </div>

        <div className="two-pane">
          <div className="job-list" aria-label="Ranked job list">
            {visibleJobs.slice(0, 45).map((item) => (
              <button key={item.job.canonicalId} data-testid="job-card" className={selectedJob?.job.canonicalId === item.job.canonicalId ? "job-card active" : "job-card"} onClick={() => setSelectedJobId(item.job.canonicalId)}>
                <div>
                  <strong>{item.job.title}</strong>
                  <span>{item.job.company} · {item.job.location} · {item.job.workMode}</span>
                </div>
                <p>{item.analysis.whatThisJobIsReallyAbout}</p>
                <div className="badge-row">
                  <Badge>Fit {item.score.predictedFit.toFixed(1)}</Badge>
                  <Badge>Hire {item.score.hireability.toFixed(1)}</Badge>
                  <Badge>{item.score.actionTier.replaceAll("_", " ")}</Badge>
                  {item.score.novelty >= 7.5 && <Badge tone="spark">Non-obvious</Badge>}
                </div>
              </button>
            ))}
          </div>

          {selectedJob && (
            <article className="job-detail" data-testid="job-detail">
              <div className="detail-top">
                <div>
                  <p className="eyebrow">{selectedJob.job.freshnessState.replaceAll("_", " ")} · DEMO DATA</p>
                  <h2>{selectedJob.job.title}</h2>
                  <p>{selectedJob.job.company} · {selectedJob.job.location} · {selectedJob.job.compensation}</p>
                </div>
                <button className="button" onClick={() => setSaved((items) => items.includes(selectedJob.job.canonicalId) ? items.filter((id) => id !== selectedJob.job.canonicalId) : [...items, selectedJob.job.canonicalId])}>
                  {saved.includes(selectedJob.job.canonicalId) ? "Saved" : "Save"}
                </button>
              </div>
              <div className="score-strip">
                <Metric icon={<Heart />} label="Work Fit" value={selectedJob.score.predictedFit.toFixed(1)} />
                <Metric icon={<Target />} label="Hireability" value={selectedJob.score.hireability.toFixed(1)} />
                <Metric icon={<Sparkles />} label="Novelty" value={selectedJob.score.novelty.toFixed(1)} />
              </div>
              <h3>What this job is really about</h3>
              <p className="actual-work">{selectedJob.analysis.whatThisJobIsReallyAbout}</p>
              <div className="detail-columns">
                <InfoList title="Why this fits you" items={selectedJob.analysis.strongMatchFactors} />
                <InfoList title="What may frustrate you" items={selectedJob.analysis.frictionFactors} />
                <InfoList title="Biggest gaps / risk" items={selectedJob.analysis.hardGaps.length ? selectedJob.analysis.hardGaps : ["No fatal core gap detected"]} />
                <InfoList title="Evidence from posting" items={selectedJob.analysis.evidenceSnippets} />
              </div>
              <div className="badge-row">
                <Badge>{selectedJob.score.sellability.replaceAll("_", " ")}</Badge>
                <Badge>{selectedJob.score.actionTier.replaceAll("_", " ")}</Badge>
                <Badge>CAF {selectedJob.score.confidenceAdjustedFit.toFixed(1)}</Badge>
                <Badge>Overall {selectedJob.score.overall.toFixed(1)}</Badge>
                <Badge>Confidence {Math.round(selectedJob.score.confidence * 100)}%</Badge>
                <Badge>Commute simulated</Badge>
              </div>
              <div className="reaction-row" aria-label="Job reactions">
                <button data-testid="reaction-love" onClick={() => reactToJob(selectedJob, "LOVE", ["love troubleshooting", "love signals/data"])}>Love</button>
                <button onClick={() => reactToJob(selectedJob, "INTERESTING", ["love experimentation"])}>Interesting</button>
                <button data-testid="reaction-dislike" onClick={() => reactToJob(selectedJob, "DISLIKE", ["too much documentation", "too much coordination"])}>Dislike</button>
                <button onClick={() => setDismissed((items) => [...items, selectedJob.job.canonicalId])}>Dismiss</button>
              </div>
              {feedbackLog.length > 0 && (
                <div className="changed" data-testid="recommendation-change">
                  <strong>Your recommendations changed because...</strong>
                  {feedbackLog.map((item) => <p key={item}>{item}</p>)}
                </div>
              )}
            </article>
          )}
        </div>
      </section>

      <section className="card-grid lab" id="debug" data-testid="debug-console">
        <div className="card">
          <h2><Bug size={22} /> Decision trace</h2>
          <p className="muted">For the selected recommendation, the reasoning is inspectable from raw evidence to tier.</p>
          <ol>
            {selectedJob?.decisionTrace.map((item) => <li key={item}>{item}</li>)}
          </ol>
        </div>
        <div className="card">
          <h2><Beaker size={22} /> Search funnel</h2>
          <dl className="funnel">
            <div><dt>Raw observations</dt><dd>{demo.searchRun.rawCount}</dd></div>
            <div><dt>Canonical jobs</dt><dd>{demo.searchRun.canonicalCount}</dd></div>
            <div><dt>Hard-filter pass</dt><dd>{demo.searchRun.hardFilterPassCount}</dd></div>
            <div><dt>Deep analysis</dt><dd>{demo.searchRun.deepAnalysisCount}</dd></div>
          </dl>
          <p className="small">Failure to reverify is modeled separately from confirmed closed; freshness remains visible instead of silently hiding jobs.</p>
        </div>
        <div className="card">
          <h2><FlaskConical size={22} /> Product Lab</h2>
          <ul>
            <li>Hypothesis: task-first presentation improves non-obvious discovery.</li>
            <li>Experiment: adaptive interview vs fixed scenarios.</li>
            <li>Known limitation: all jobs are synthetic; scores are heuristic.</li>
            <li>Governance: core ontology and scoring philosophy require owner approval before production changes.</li>
          </ul>
        </div>
      </section>
    </main>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="metric">{icon}<span>{label}</span><strong>{value}</strong></div>;
}

function Score({ label, value }: { label: string; value: number }) {
  return <span><strong>{value.toFixed(1)}</strong>{label}</span>;
}

function Badge({ children, tone }: { children: React.ReactNode; tone?: "spark" }) {
  return <span className={tone === "spark" ? "badge spark" : "badge"}>{children}</span>;
}

function InfoList({ title, items }: { title: string; items: string[] }) {
  return <div><h3>{title}</h3><ul>{items.map((item) => <li key={item}>{item}</li>)}</ul></div>;
}
