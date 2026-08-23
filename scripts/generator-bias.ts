import { createHash } from "node:crypto";
import { DIMENSION_IDS, vector } from "../src/config/model";
import { assessGeneratorSelectionBias, assessSamplerUniformity } from "../src/lab/generatorBias";
import { generateOnetSubjects, ONET_LAB_SEED } from "../src/lab/onetLab";
import { planPreferenceStatements } from "../src/lab/preferencePhrases";
import { hashSeed, mulberry32 } from "../src/lab/rng";

/**
 * Declared tolerances for the positional-bias gate.
 *
 * The sampler-uniformity test is the mechanism gate: with all 17 dimensions equally
 * expressible, only the sampling procedure can make selection rates differ, so a
 * chi-square below the alpha=0.001 critical value and a near-zero position correlation
 * establish that array position confers no advantage. The corpus-level statistics are
 * descriptive: with only 17 dimensions their rank correlation is noisy (standard error
 * about 0.25 under the null), so the corpus gate is set on the magnitude quantities --
 * selection-rate spread and the first/second-half gap -- rather than on the rank
 * correlation. These are declared sampling tolerances, not tuned scores.
 */
export const POSITIONAL_BIAS_TOLERANCES = {
  maxAbsSamplerPositionSpearman: 0.35,
  maxCorpusSelectionRateSpread: 0.2,
  maxCorpusHalfMeanSelectionRateGap: 0.12,
};

const subjects = generateOnetSubjects(ONET_LAB_SEED);
const corpus = assessGeneratorSelectionBias(subjects);

// All 17 dimensions equally expressible (truth 8.5 everywhere), so any difference in
// selection rate across dimensions comes from the sampler alone.
const uniformTruth = vector(Object.fromEntries(DIMENSION_IDS.map((id) => [id, 8.5])));
const sampler = assessSamplerUniformity((trial) => {
  const rng = mulberry32(hashSeed(`sampler-uniformity:${trial}`));
  return planPreferenceStatements(uniformTruth, rng, {
    sources: { resumeNarrative: true, explicitPreferenceList: true, explicitDislikeList: true, contradictoryStatement: true },
    includeAspiration: true,
  }).selected.map((entry) => entry.dimensionId);
});

const samplerPass =
  Math.abs(sampler.positionVersusRateSpearman) <= POSITIONAL_BIAS_TOLERANCES.maxAbsSamplerPositionSpearman &&
  sampler.chiSquare <= sampler.chiSquareCriticalValue;
const corpusPass =
  corpus.selectionRateSpread <= POSITIONAL_BIAS_TOLERANCES.maxCorpusSelectionRateSpread &&
  Math.abs(corpus.firstHalfMeanSelectionRate - corpus.secondHalfMeanSelectionRate) <= POSITIONAL_BIAS_TOLERANCES.maxCorpusHalfMeanSelectionRateGap;

const output = {
  seed: ONET_LAB_SEED,
  tolerances: POSITIONAL_BIAS_TOLERANCES,
  pass: samplerPass && corpusPass,
  samplerPass,
  corpusPass,
  samplerUniformity: sampler,
  corpusSelectionBias: corpus,
};
const json = JSON.stringify(output, null, 2) + "\n";
process.stdout.write(json);
process.stderr.write(`output-sha256=${createHash("sha256").update(json).digest("hex")}\n`);
if (!output.pass) process.exitCode = 1;
