import { mkdirSync, writeFileSync } from "node:fs";
import { generateTwins, generateVirtualSubjects } from "../src/lab/generate";
import { OCCUPATION_SOURCE } from "../src/lab/occupations";

const seed = Number(process.argv.find((arg) => arg.startsWith("--seed="))?.slice(7) ?? 20260822);
const subjects = generateVirtualSubjects(seed);
const twins = generateTwins(subjects, seed);
mkdirSync("artifacts/subjects", { recursive: true });
writeFileSync("artifacts/subjects/subjects.json", JSON.stringify(subjects.map((subject) => ({
  subjectId: subject.truth.subjectId,
  cohort: subject.truth.cohort,
  occupation: subject.truth.occupationalSkeleton.title,
  family: subject.truth.occupationalSkeleton.family,
  observations: {
    resumeText: subject.observations.resumeText,
    apparentField: subject.observations.apparentField,
    sparse: subject.observations.evidenceQualityMetadata.sparse,
  },
  hidden: {
    occupationFitsPreference: subject.truth.careerHistoryTruth.occupationFitsPreference,
    expected: subject.truth.expectedGeneralProperties,
  },
})), null, 2));
writeFileSync("artifacts/subjects/twins.json", JSON.stringify(twins.map((pair) => ({ id: pair.id, kind: pair.kind })), null, 2));
writeFileSync("artifacts/subjects/manifest.json", JSON.stringify({ seed, count: subjects.length, occupationSource: OCCUPATION_SOURCE }, null, 2));
console.log(JSON.stringify({ seed, count: subjects.length, twins: twins.length }, null, 2));
