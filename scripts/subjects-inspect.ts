import { inspectSubject } from "../src/lab/audit";

const subjectId = process.argv[2] ?? "subject-001";
const result = inspectSubject(subjectId);
console.log(JSON.stringify({
  subjectId,
  occupation: result.subject.truth.occupationalSkeleton.title,
  cohort: result.subject.truth.cohort,
  resume: result.subject.observations.resumeText,
  evaluation: result.evaluation,
  confidence: result.profile.confidence,
  topFunctions: undefined,
}, null, 2));
