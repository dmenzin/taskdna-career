// Adapters that turn O*NET occupation skeletons into the engine's job/occupation
// structures. These provide WORK EXPOSURE structure only. They never assert what a
// person likes: preference truth is always generated independently in the lab.
import type { JobPosting } from "@/domain/types";
import type { OccupationSkeleton } from "@/lab/types";
import { stratumFor, type OnetStratum } from "@/onet/strata";
import type { OnetOccupationSkeleton } from "@/onet/types";

const SENIORITY_BY_JOB_ZONE: Record<number, JobPosting["seniority"]> = {
  1: "Associate",
  2: "Associate",
  3: "Mid",
  4: "Mid",
  5: "Senior",
};

/** Deterministically express an O*NET occupation as a JobPosting the engine can analyze. */
export function occupationToJobPosting(occupation: OnetOccupationSkeleton): JobPosting {
  const requirements = [
    ...occupation.essentialSkills.slice(0, 4).map((skill) => skill.name),
    ...occupation.knowledge.slice(0, 2).map((item) => item.name),
  ];
  const preferred = occupation.transferableSkills.slice(0, 3).map((skill) => skill.name);
  return {
    canonicalId: `onet-${occupation.onetSocCode}`,
    company: "Occupation Corpus",
    title: occupation.title,
    location: "Remote - US",
    workMode: "Onsite",
    compensation: "not modeled",
    seniority: SENIORITY_BY_JOB_ZONE[occupation.jobZone ?? 3] ?? "Mid",
    description: occupation.description,
    responsibilities: occupation.taskStatements.slice(0, 8).map((task) => task.statement),
    requirements,
    preferredRequirements: preferred,
    domain: stratumFor(occupation).replaceAll("_", " "),
    requisitionId: `ONET-${occupation.onetSocCode}`,
    sourceObservationIds: [`onet-${occupation.onetSocCode}`],
    canonicalizationConfidence: 0.9,
    freshnessState: "VERIFIED_LIVE",
    firstSeen: "2026-08-01T00:00:00.000Z",
    lastSeen: "2026-08-20T00:00:00.000Z",
    lastVerified: "2026-08-21T00:00:00.000Z",
  };
}

/** Express an O*NET occupation in the lab's OccupationSkeleton shape (exposure vocabulary). */
export function occupationToLabSkeleton(occupation: OnetOccupationSkeleton): OccupationSkeleton & { stratum: OnetStratum; onetSocCode: string } {
  const stratum = stratumFor(occupation);
  return {
    onetCode: occupation.onetSocCode,
    onetSocCode: occupation.onetSocCode,
    title: occupation.title,
    family: stratum,
    stratum,
    industry: stratum.replaceAll("_", " "),
    tasks: occupation.taskStatements.slice(0, 10).map((task) => task.statement),
    generalizedWorkActivities: occupation.workActivities.slice(0, 12).map((activity) => activity.name),
    skills: occupation.essentialSkills.slice(0, 6).map((skill) => skill.name.toLowerCase()),
    knowledge: occupation.knowledge.slice(0, 5).map((item) => item.name.toLowerCase()),
    workContext: occupation.workContext.slice(0, 6).map((context) => context.name.toLowerCase()),
    source: "onet-30.3",
  };
}
