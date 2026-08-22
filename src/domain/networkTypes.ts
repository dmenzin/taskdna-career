import type { DimensionId, ScoredJob } from "@/domain/types";

export type RelationshipType =
  | "CURRENT_MANAGER"
  | "FORMER_MANAGER"
  | "CURRENT_COWORKER"
  | "FORMER_COWORKER"
  | "PROFESSOR"
  | "ADVISOR"
  | "MENTOR"
  | "CLASSMATE"
  | "ALUM"
  | "INDUSTRY_CONTACT"
  | "RECRUITER"
  | "FORMER_RECRUITER"
  | "CLIENT_OR_CUSTOMER"
  | "VENDOR_OR_PARTNER"
  | "FRIEND"
  | "FAMILY_CONNECTION"
  | "SECOND_DEGREE"
  | "BRIEF_ACQUAINTANCE"
  | "DORMANT_FORMER_STRONG_TIE"
  | "COLD_CONTEXTUAL_CONTACT"
  | "OTHER";

export type AskType =
  | "RECONNECT"
  | "CATCH_UP"
  | "CAREER_PERSPECTIVE"
  | "FUNCTION_INSIGHT"
  | "ROLE_REALITY"
  | "COMPANY_INFORMATION"
  | "TEAM_INFORMATION"
  | "SKILL_ADVICE"
  | "FIT_REALITY_CHECK"
  | "WHO_SHOULD_I_TALK_TO"
  | "INTRODUCTION_REQUEST"
  | "SECOND_DEGREE_INTRO_REQUEST"
  | "REFERRAL_REQUEST"
  | "RESUME_FORWARD_REQUEST"
  | "HIRING_MANAGER_INTRO_REQUEST"
  | "RECRUITER_INTRO_REQUEST"
  | "REFERENCE_REQUEST"
  | "HIDDEN_OPPORTUNITY_QUERY"
  | "APPLICATION_STATUS_HELP"
  | "POST_APPLICATION_NOTE"
  | "FOLLOW_UP"
  | "THANK_YOU"
  | "RELATIONSHIP_MAINTENANCE"
  | "SHARE_USEFUL_RESOURCE"
  | "SCHEDULE_CONVERSATION"
  | "SEND_REQUESTED_MATERIAL";

export type Channel = "EMAIL" | "LINKEDIN_MANUAL" | "TEXT" | "PHONE" | "VIDEO" | "IN_PERSON" | "OTHER";
export type EdgeCertainty = "CONFIRMED" | "USER_REPORTED" | "INFERRED" | "HYPOTHESIZED" | "SYNTHETIC";
export type ExecutionMode = "SIMULATE" | "DRAFT_ONLY" | "MANUAL_SEND" | "APPROVAL_REQUIRED_SEND" | "AUTHORIZED_AUTOMATION" | "CHANNEL_POLICY_BLOCKED";
export type ApplicationNetworkStrategy = "APPLY_NOW_NETWORK_IN_PARALLEL" | "NETWORK_FIRST_BRIEFLY" | "APPLY_FIRST_THEN_ROUTE" | "INFORMATION_FIRST" | "DIRECT_APPLY_ONLY" | "NETWORK_BUILD_NO_CURRENT_JOB" | "DO_NOT_SPEND_SOCIAL_CAPITAL" | "WAIT_FOR_SPECIFIC_EVENT";
export type InteractionEventType =
  | "MESSAGE_DRAFTED"
  | "MESSAGE_SENT"
  | "MESSAGE_RECEIVED"
  | "NO_RESPONSE"
  | "FOLLOWUP_SENT"
  | "MEETING_PROPOSED"
  | "MEETING_SCHEDULED"
  | "CONVERSATION_OCCURRED"
  | "ADVICE_RECEIVED"
  | "CONTACT_SUGGESTED_PERSON"
  | "INTRO_OFFERED"
  | "INTRO_REQUESTED"
  | "INTRO_MADE"
  | "INTRO_DECLINED"
  | "REFERRAL_OFFERED"
  | "REFERRAL_REQUESTED"
  | "REFERRAL_SUBMITTED"
  | "RESUME_REQUESTED"
  | "MATERIAL_SENT"
  | "HIRING_MANAGER_IDENTIFIED"
  | "RECRUITER_IDENTIFIED"
  | "ROLE_SHARED"
  | "APPLICATION_SUBMITTED"
  | "INTERVIEW_RECEIVED"
  | "OFFER_RECEIVED"
  | "REJECTION_RECEIVED"
  | "THANK_YOU_SENT"
  | "BOUNDARY_EXPRESSED"
  | "DO_NOT_CONTACT"
  | "OTHER";

export interface Organization {
  id: string;
  name: string;
  domain: string;
  synthetic: boolean;
}

export interface Team {
  id: string;
  organizationId: string;
  name: string;
  functionIds: string[];
  synthetic: boolean;
}

export interface Person {
  id: string;
  name: string;
  title: string;
  organizationId: string;
  location: string;
  currentRoleSummary: string;
  functionalAreas: string[];
  seniority: "IC" | "Lead" | "Manager" | "Director" | "Recruiter" | "Professor";
  synthetic: boolean;
}

export interface Relationship {
  id: string;
  userId: string;
  personId: string;
  personaId: string;
  relationshipType: RelationshipType;
  howMet: string;
  relationshipContext: string;
  sharedWork: string[];
  whatTheyKnowAboutUser: string[];
  memorableContext: string;
  lastMeaningfulContactDays: number;
  contactFrequency: "weekly" | "monthly" | "quarterly" | "yearly" | "rare";
  responsePattern: "fast" | "reliable" | "slow" | "unknown" | "no_response_recently";
  warmthObserved: number;
  trustObserved: number;
  familiarity: number;
  reciprocity: number;
  responsiveness: number;
  engagement: number;
  currentMomentum: number;
  askFatigue: number;
  dormancy: number;
  userComfortAdvice: number;
  userComfortIntro: number;
  userComfortReferral: number;
  communicationStyle: "BRIEF_DIRECT" | "WARM_CONVERSATIONAL" | "PROFESSIONAL_CONCISE";
  preferredChannel: Channel;
  userRead: string;
  explicitBoundaries: string[];
}

export interface InteractionEvent {
  id: string;
  relationshipId: string;
  opportunityId?: string;
  timestamp: string;
  channel: Channel;
  direction: "OUTBOUND" | "INBOUND" | "SYSTEM";
  eventType: InteractionEventType;
  rawText?: string;
  structuredSummary: string;
  warmthSignal?: number;
  engagementSignal?: number;
  explicitOffer?: AskType;
  explicitBoundary?: AskType;
  explicitCommitment?: string;
  requestedFollowup?: string;
  dueDate?: string;
  inferredStateChanges: string[];
  userConfirmed: boolean;
  synthetic: boolean;
}

export interface NetworkingPrinciple {
  id: string;
  title: string;
  principle: string;
  evidenceGrade: "A" | "B" | "C" | "D" | "E";
  evidenceType: string;
  sourceTitle: string;
  sourceAuthors: string;
  sourceYear: number;
  sourceIdentifier: string;
  applicableContext: string;
  exceptions: string[];
  productImplication: string;
  version: string;
  active: boolean;
}

export interface ContactOpportunityAssessment {
  personId: string;
  opportunityId: string;
  relationshipStrength: number;
  engagement: number;
  networkNovelty: number;
  functionalRelevance: number;
  companyRelevance: number;
  teamProximity: number;
  informationValue: number;
  routingValue: number;
  credibilityValue: number;
  referralAbility: number;
  advocacyPotential: number;
  secondDegreeReach: number;
  askReadiness: Record<AskType, number>;
  socialCost: number;
  confidence: number;
  evidenceIds: string[];
  explanation: string;
  version: string;
}

export interface NetworkPath {
  id: string;
  opportunityId: string;
  pathType: "DIRECT" | "SECOND_DEGREE" | "THIRD_DEGREE_HYPOTHESIS";
  peopleIds: string[];
  hopCount: number;
  edgeCertainty: EdgeCertainty;
  firstHopReadiness: number;
  functionalRelevance: number;
  companyTeamProximity: number;
  askRequired: AskType;
  socialCost: number;
  informationValue: number;
  routingValue: number;
  credibilityValue: number;
  pathScore: number;
  confidence: number;
  explanation: string;
}

export interface OpportunityAccessAssessment {
  opportunityId: string;
  directContactIds: string[];
  secondDegreePathIds: string[];
  informationAccess: number;
  routingAccess: number;
  credibilityAccess: number;
  referralAccess: number;
  advocacyAccess: number;
  strongestPathId?: string;
  pathConfidence: number;
  socialCost: number;
  timing: string;
  networkAccessSummary: string;
}

export interface InteractionPlan {
  id: string;
  personId: string;
  opportunityId?: string;
  objective: string;
  whyThisPerson: string;
  relationshipInterpretation: string;
  currentState: string;
  recommendedAskType: AskType;
  askReadiness: number;
  askBurden: number;
  socialCost: number;
  urgency: number;
  sharedContextToUse: string[];
  factsNotToAssume: string[];
  tone: Relationship["communicationStyle"];
  channel: Channel;
  messageLength: "short" | "medium" | "long";
  directness: number;
  successCondition: string;
  acceptablePartialSuccess: string;
  escalationIfPositive: string;
  actionIfNeutral: string;
  actionIfNoResponse: string;
  actionIfDeclined: string;
  thingsNotToAskYet: AskType[];
  timingRecommendation: string;
  reasoningTrace: string[];
  executionMode: ExecutionMode;
  modelVersion: string;
  createdAt: string;
}

export interface MessageDraft {
  id: string;
  interactionPlanId: string;
  subject?: string;
  body: string;
  style: Relationship["communicationStyle"];
  groundedFields: string[];
  warnings: string[];
}

export interface NextBestAction {
  id: string;
  actionType: "APPLY_TO_JOB" | "CONTACT_PERSON" | "RECONNECT_PERSON" | "ASK_ADVICE" | "ASK_INTRO" | "ASK_REFERRAL" | "SEND_REQUESTED_MATERIAL" | "FOLLOW_UP" | "THANK_CONTACT" | "SCHEDULE_CONVERSATION" | "LOG_OUTCOME" | "WAIT" | "DO_NOT_CONTACT" | "BUILD_NETWORK_IN_FUNCTION" | "SKILL_GAP_ACTION";
  title: string;
  whyNow: string;
  opportunityValue: number;
  networkValue: number;
  socialCost: number;
  timeEstimateMinutes: number;
  urgency: number;
  expectedInformationAccessGain: number;
  dependencies: string[];
  priority: number;
  relatedOpportunityId?: string;
  relatedPersonId?: string;
  interactionPlan?: InteractionPlan;
  draft?: MessageDraft;
}

export interface OpportunityPursuitPlan {
  opportunityId: string;
  intrinsicJobSummary: string;
  networkAccessSummary: string;
  applicationStrategy: ApplicationNetworkStrategy;
  networkingStrategy: string;
  recommendedSequence: string[];
  parallelActions: string[];
  bestContactId?: string;
  backupContactIds: string[];
  bestNetworkPathId?: string;
  recommendedAsk?: AskType;
  askReadiness: number;
  socialCost: number;
  applyNow: boolean;
  delayWarning?: string;
  freshnessRationale: string;
  successConditions: string[];
  stopConditions: string[];
  createdAt: string;
  version: string;
}

export interface HumanOpportunityGraph {
  personaId: string;
  organizations: Organization[];
  teams: Team[];
  people: Person[];
  relationships: Relationship[];
  interactions: InteractionEvent[];
  principles: NetworkingPrinciple[];
  contactAssessments: ContactOpportunityAssessment[];
  paths: NetworkPath[];
  accessAssessments: OpportunityAccessAssessment[];
  pursuitPlans: OpportunityPursuitPlan[];
  nextBestActions: NextBestAction[];
  topFunctionCoverage: Record<string, "STRONG_COVERAGE" | "MODERATE_COVERAGE" | "NETWORK_GAP" | "UNKNOWN">;
  networkGaps: { functionId: string; missingNodeType: string; rationale: string }[];
  scoredJobs: ScoredJob[];
}

export interface ContactNetworkRelevance {
  personId: string;
  functionIds: string[];
  dimensionHints: DimensionId[];
}
