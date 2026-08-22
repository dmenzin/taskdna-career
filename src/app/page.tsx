"use client";

import { useMemo, useState } from "react";
import {
  SKILL_CATALOG,
  getSkillLabel,
  type CareerMatch,
  type SkillCategory,
} from "@/lib/careers";

const CATEGORY_ORDER: SkillCategory[] = [
  "Technical",
  "Analytical",
  "Creative",
  "People",
  "Business",
];

const DEMAND_STYLES: Record<string, string> = {
  High: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  Growing: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  Steady: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
};

export default function Home() {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [matches, setMatches] = useState<CareerMatch[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const grouped = useMemo(() => {
    return CATEGORY_ORDER.map((category) => ({
      category,
      skills: SKILL_CATALOG.filter((s) => s.category === category),
    }));
  }, []);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function analyze() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skills: [...selected] }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }
      const data = await res.json();
      setMatches(data.matches as CareerMatch[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setSelected(new Set());
    setMatches(null);
    setError(null);
  }

  return (
    <main className="flex-1">
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_0%,rgba(99,102,241,0.18),transparent_70%)]" />
        <div className="mx-auto max-w-5xl px-6 pt-20 pb-10 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-indigo-200/60 bg-white/60 px-4 py-1.5 text-sm font-medium text-indigo-700 shadow-sm backdrop-blur dark:border-indigo-400/20 dark:bg-white/5 dark:text-indigo-300">
            <span className="h-2 w-2 rounded-full bg-indigo-500" />
            TaskDNA Career
          </span>
          <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-6xl">
            Find your{" "}
            <span className="bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-sky-500 bg-clip-text text-transparent">
              dream job
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-black/60 dark:text-white/60">
            Every person has a unique career DNA. Select the skills that feel
            most like you, and we&apos;ll instantly match you to the careers
            where you&apos;ll thrive.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-24">
        <div className="rounded-3xl border border-black/5 bg-white/70 p-6 shadow-xl shadow-indigo-500/5 backdrop-blur sm:p-8 dark:border-white/10 dark:bg-white/5">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold">1. Pick your strengths</h2>
            <span
              className="text-sm font-medium text-black/50 dark:text-white/50"
              data-testid="selected-count"
            >
              {selected.size} selected
            </span>
          </div>

          <div className="mt-6 space-y-6">
            {grouped.map(({ category, skills }) => (
              <div key={category}>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-black/40 dark:text-white/40">
                  {category}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {skills.map((skill) => {
                    const active = selected.has(skill.id);
                    return (
                      <button
                        key={skill.id}
                        type="button"
                        onClick={() => toggle(skill.id)}
                        aria-pressed={active}
                        className={
                          "rounded-full border px-4 py-2 text-sm font-medium transition " +
                          (active
                            ? "border-transparent bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                            : "border-black/10 bg-white text-black/70 hover:border-indigo-300 hover:text-indigo-600 dark:border-white/15 dark:bg-white/5 dark:text-white/70 dark:hover:border-indigo-400/40")
                        }
                      >
                        {skill.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={analyze}
              disabled={selected.size === 0 || loading}
              className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? "Analyzing…" : "Analyze my career DNA"}
            </button>
            {(matches || selected.size > 0) && (
              <button
                type="button"
                onClick={reset}
                className="rounded-full px-4 py-3 text-sm font-medium text-black/60 transition hover:text-black dark:text-white/60 dark:hover:text-white"
              >
                Reset
              </button>
            )}
          </div>

          {error && (
            <p className="mt-4 text-sm font-medium text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
        </div>

        {matches && (
          <div className="mt-12" data-testid="results">
            <h2 className="text-xl font-semibold">
              2. Your top career matches
            </h2>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              {matches.slice(0, 6).map((match, index) => (
                <article
                  key={match.career.id}
                  className="flex flex-col rounded-2xl border border-black/5 bg-white/80 p-6 shadow-sm transition hover:shadow-lg dark:border-white/10 dark:bg-white/5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        {index === 0 && (
                          <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-xs font-bold text-white">
                            Best fit
                          </span>
                        )}
                        <span
                          className={
                            "rounded-full px-2 py-0.5 text-xs font-semibold " +
                            DEMAND_STYLES[match.career.demand]
                          }
                        >
                          {match.career.demand} demand
                        </span>
                      </div>
                      <h3 className="mt-2 text-lg font-semibold">
                        {match.career.title}
                      </h3>
                    </div>
                    <div className="text-right">
                      <div
                        className="text-2xl font-bold text-indigo-600 dark:text-indigo-400"
                        data-testid={`score-${match.career.id}`}
                      >
                        {match.score}%
                      </div>
                      <div className="text-xs text-black/40 dark:text-white/40">
                        match
                      </div>
                    </div>
                  </div>

                  <p className="mt-3 text-sm text-black/60 dark:text-white/60">
                    {match.career.blurb}
                  </p>

                  <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 transition-all"
                      style={{ width: `${match.score}%` }}
                    />
                  </div>

                  <dl className="mt-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-black/40 dark:text-white/40">
                        Salary
                      </dt>
                      <dd className="font-medium">{match.career.salaryRange}</dd>
                    </div>
                  </dl>

                  {match.matchedSkills.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                        Your matching skills
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {match.matchedSkills.map((id) => (
                          <span
                            key={id}
                            className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                          >
                            {getSkillLabel(id)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {match.growthSkills.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-black/40 dark:text-white/40">
                        Skills to grow into
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {match.growthSkills.map((id) => (
                          <span
                            key={id}
                            className="rounded-full border border-black/10 px-2.5 py-1 text-xs font-medium text-black/50 dark:border-white/15 dark:text-white/50"
                          >
                            {getSkillLabel(id)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </div>
        )}
      </section>

      <footer className="border-t border-black/5 py-8 text-center text-sm text-black/40 dark:border-white/10 dark:text-white/40">
        TaskDNA Career — helping people find their dream jobs.
      </footer>
    </main>
  );
}
