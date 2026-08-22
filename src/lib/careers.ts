export type SkillCategory =
  | "Technical"
  | "Creative"
  | "People"
  | "Analytical"
  | "Business";

export interface Skill {
  id: string;
  label: string;
  category: SkillCategory;
}

export interface Career {
  id: string;
  title: string;
  blurb: string;
  salaryRange: string;
  demand: "High" | "Growing" | "Steady";
  /** Skill id -> importance weight (1-5) for this career. */
  skills: Record<string, number>;
}

export interface CareerMatch {
  career: Career;
  /** 0-100 fit score. */
  score: number;
  matchedSkills: string[];
  growthSkills: string[];
}

export const SKILL_CATALOG: Skill[] = [
  { id: "coding", label: "Coding", category: "Technical" },
  { id: "data", label: "Data & Statistics", category: "Analytical" },
  { id: "design", label: "Visual Design", category: "Creative" },
  { id: "writing", label: "Writing", category: "Creative" },
  { id: "communication", label: "Communication", category: "People" },
  { id: "leadership", label: "Leadership", category: "People" },
  { id: "problem-solving", label: "Problem Solving", category: "Analytical" },
  { id: "empathy", label: "Empathy", category: "People" },
  { id: "strategy", label: "Strategy", category: "Business" },
  { id: "sales", label: "Sales & Persuasion", category: "Business" },
  { id: "research", label: "Research", category: "Analytical" },
  { id: "product", label: "Product Sense", category: "Business" },
  { id: "ml", label: "Machine Learning", category: "Technical" },
  { id: "systems", label: "Systems Thinking", category: "Technical" },
  { id: "storytelling", label: "Storytelling", category: "Creative" },
  { id: "organization", label: "Organization", category: "Business" },
];

export const CAREERS: Career[] = [
  {
    id: "software-engineer",
    title: "Software Engineer",
    blurb: "Design, build, and ship the software products people rely on every day.",
    salaryRange: "$95k – $180k",
    demand: "High",
    skills: { coding: 5, "problem-solving": 5, systems: 4, communication: 2 },
  },
  {
    id: "data-scientist",
    title: "Data Scientist",
    blurb: "Turn messy data into decisions with statistics and machine learning.",
    salaryRange: "$100k – $190k",
    demand: "High",
    skills: { data: 5, ml: 4, "problem-solving": 4, coding: 3, research: 3 },
  },
  {
    id: "product-manager",
    title: "Product Manager",
    blurb: "Guide products from idea to launch by aligning users, design, and engineering.",
    salaryRange: "$110k – $200k",
    demand: "Growing",
    skills: { product: 5, strategy: 4, communication: 4, leadership: 3, data: 2 },
  },
  {
    id: "ux-designer",
    title: "UX Designer",
    blurb: "Craft intuitive, beautiful experiences that delight users.",
    salaryRange: "$85k – $160k",
    demand: "Growing",
    skills: { design: 5, empathy: 4, research: 3, communication: 3, product: 2 },
  },
  {
    id: "technical-writer",
    title: "Technical Writer",
    blurb: "Explain complex systems clearly so people can actually use them.",
    salaryRange: "$70k – $130k",
    demand: "Steady",
    skills: { writing: 5, communication: 4, research: 3, systems: 2, storytelling: 3 },
  },
  {
    id: "engineering-manager",
    title: "Engineering Manager",
    blurb: "Grow high-performing engineering teams and deliver impactful work.",
    salaryRange: "$140k – $240k",
    demand: "Growing",
    skills: { leadership: 5, communication: 5, strategy: 3, coding: 2, "problem-solving": 3 },
  },
  {
    id: "growth-marketer",
    title: "Growth Marketer",
    blurb: "Blend creativity and data to grow audiences and revenue.",
    salaryRange: "$75k – $150k",
    demand: "Growing",
    skills: { sales: 4, data: 3, storytelling: 4, strategy: 3, writing: 3 },
  },
  {
    id: "ml-engineer",
    title: "Machine Learning Engineer",
    blurb: "Take models from notebooks to production at scale.",
    salaryRange: "$120k – $220k",
    demand: "High",
    skills: { ml: 5, coding: 5, data: 4, systems: 4, "problem-solving": 4 },
  },
  {
    id: "ux-researcher",
    title: "UX Researcher",
    blurb: "Uncover what users truly need through rigorous research.",
    salaryRange: "$90k – $165k",
    demand: "Steady",
    skills: { research: 5, empathy: 4, communication: 3, data: 3, writing: 2 },
  },
  {
    id: "solutions-consultant",
    title: "Solutions Consultant",
    blurb: "Bridge customers and technology to close deals and solve real problems.",
    salaryRange: "$95k – $180k",
    demand: "Growing",
    skills: { sales: 5, communication: 5, "problem-solving": 3, product: 3, strategy: 3 },
  },
  {
    id: "operations-manager",
    title: "Operations Manager",
    blurb: "Keep the business running smoothly by optimizing people and process.",
    salaryRange: "$80k – $150k",
    demand: "Steady",
    skills: { organization: 5, leadership: 4, strategy: 3, communication: 4, data: 2 },
  },
  {
    id: "founder",
    title: "Startup Founder",
    blurb: "Turn a bold vision into a company by wearing every hat at once.",
    salaryRange: "Equity + $0 – $150k",
    demand: "Growing",
    skills: { strategy: 5, leadership: 4, sales: 4, product: 4, communication: 4 },
  },
];

export function getSkillLabel(id: string): string {
  return SKILL_CATALOG.find((s) => s.id === id)?.label ?? id;
}

/**
 * Rank careers by how well the selected skills cover each career's weighted
 * skill profile. Score is the share of a career's total skill weight that the
 * user already has, expressed as 0-100.
 */
export function matchCareers(selectedSkills: string[]): CareerMatch[] {
  const selected = new Set(selectedSkills);

  const matches: CareerMatch[] = CAREERS.map((career) => {
    const entries = Object.entries(career.skills);
    const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0);

    let earnedWeight = 0;
    const matchedSkills: string[] = [];
    const growthSkills: { id: string; weight: number }[] = [];

    for (const [skillId, weight] of entries) {
      if (selected.has(skillId)) {
        earnedWeight += weight;
        matchedSkills.push(skillId);
      } else {
        growthSkills.push({ id: skillId, weight });
      }
    }

    const score =
      totalWeight === 0 ? 0 : Math.round((earnedWeight / totalWeight) * 100);

    growthSkills.sort((a, b) => b.weight - a.weight);

    return {
      career,
      score,
      matchedSkills,
      growthSkills: growthSkills.slice(0, 3).map((g) => g.id),
    };
  });

  return matches.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.career.title.localeCompare(b.career.title);
  });
}
