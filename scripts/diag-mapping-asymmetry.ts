// Diagnostic: is the person-side / job-side canonical mapping asymmetry algorithmic, or an
// artifact of asymmetric rendering?
//
// `renderJobResponsibility` (src/bench/render.ts) hardcodes its paraphrase to "standard"
// regardless of the requested difficulty, while every person-side renderer honours it. At
// `hard`, person text additionally has HARD_DROP_RATE of its content words removed. The
// reported gap (person_experience 0.181 vs job_responsibility 0.850) therefore compares
// degraded text against intact text. This walks the difficulty ladder to separate the two.
import { runMappingBenchmark } from "../src/bench/mapping";

const people = Number(process.argv.find((a) => a.startsWith("--people="))?.split("=")[1] ?? 12);
for (const difficulty of ["verbatim", "standard", "hard"] as const) {
  const report = runMappingBenchmark({ split: "DEVELOPMENT", difficulty, people });
  const row = Object.fromEntries(report.streams.map((s) => [s.stream, s.exactTop1Accuracy])) as Record<string, number>;
  const pe = row.person_experience ?? 0;
  const jr = row.job_responsibility ?? 0;
  process.stdout.write(
    `${difficulty.padEnd(9)} person_exp=${pe.toFixed(3)}  person_pref=${(row.person_preference ?? 0).toFixed(3)}` +
    `  person_dir=${(row.person_direction ?? 0).toFixed(3)}  job_resp=${jr.toFixed(3)}` +
    `  job/person=${pe ? (jr / pe).toFixed(2) : "inf"}x\n`,
  );
}
