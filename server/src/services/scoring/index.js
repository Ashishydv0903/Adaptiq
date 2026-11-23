import { evaluateRubric, RUBRIC_PROMPT_VERSION } from './rubricScorer.js';
import { detectConceptCoverage, CONCEPT_PROMPT_VERSION } from './conceptCoverage.js';
import { generateConceptCounterfactuals } from './counterfactual.js';
import {
  extractScoringFeatures,
  predictRidgeScore,
  DEFAULT_RIDGE_WEIGHTS,
  DEFAULT_RIDGE_INTERCEPT,
  DEFAULT_RIDGE_BASELINE,
  calculateIntegrityMultiplier
} from '../../ml/scoringModel.js';
import { calculateLinearShapValues } from '../../ml/shap.js';
import { env } from '../../config/env.js';

/**
 * Computes a side-by-side structured comparison between candidate answer and benchmark ideal answer
 *
 * @param {string} candidateAnswer
 * @param {string} idealAnswer
 * @param {Array<{ concept: string, status: string }>} concepts
 * @returns {Object} Structured side-by-side diff
 */
export function generateModelAnswerDiff(candidateAnswer, idealAnswer, concepts = []) {
  const candidateWords = candidateAnswer ? candidateAnswer.split(/\s+/) : [];
  const idealWords = idealAnswer ? idealAnswer.split(/\s+/) : [];

  const matchedConcepts = concepts.filter((c) => c.status === 'covered').map((c) => c.concept);
  const partialConcepts = concepts.filter((c) => c.status === 'partially_covered').map((c) => c.concept);
  const missedConcepts = concepts.filter((c) => c.status === 'missing').map((c) => c.concept);

  return {
    candidateAnswer,
    idealAnswer,
    wordCount: {
      candidate: candidateWords.length,
      ideal: idealWords.length,
      ratio: idealWords.length > 0 ? Number((candidateWords.length / idealWords.length).toFixed(2)) : 1.0
    },
    conceptComparison: {
      matched: matchedConcepts,
      partiallyMatched: partialConcepts,
      omitted: missedConcepts
    },
    summary: `Candidate covered ${matchedConcepts.length} of ${concepts.length} key concepts (${missedConcepts.length} missing).`
  };
}

/**
 * Executes the complete AdaptIQ Scoring Pipeline:
 * 1. Rubric Scorer (Correctness, Depth, Clarity, Completeness, Relevance) - 3 runs, median & variance
 * 2. Evidence Quote Verification against candidate answer text
 * 3. Concept-Coverage Detection via Semantic Embeddings + LLM confirmation
 * 4. Feature Extraction & Ridge Regression Scoring Model
 * 5. Exact Linear SHAP Values (satisfying Efficiency Property)
 * 6. Counterfactual Feedback by simulating each missing concept
 * 7. Model-Answer Side-by-Side Diff
 *
 * @param {Object} params
 * @param {Object} params.question - Full question record with prompt, idealAnswer, keyConcepts
 * @param {string} params.candidateAnswer - Candidate's open-ended answer
 * @param {Object} [params.telemetry] - Integrity telemetry (tab switches, duration)
 * @param {Object} [params.options]
 * @param {number} [params.options.runCount=3] - Number of rubric runs for median consensus
 * @returns {Promise<Object>} Comprehensive scoring pipeline output
 */
export async function executeScoringPipeline({
  question,
  candidateAnswer,
  telemetry = {},
  options = {}
}) {
  const model = env.GEMINI_MODEL || 'gemini-1.5-flash';
  const runCount = options.runCount ?? 3;

  // Run Rubric Scorer & Concept Coverage in parallel
  const [rubricResult, conceptResult] = await Promise.all([
    evaluateRubric({
      question,
      candidateAnswer,
      runCount
    }),
    detectConceptCoverage({
      question,
      candidateAnswer
    })
  ]);

  // Extract normalized [0, 10] features
  const features = extractScoringFeatures({
    rubricScores: rubricResult.rubricScores,
    conceptCoverageRatio: conceptResult.coverageRatio,
    semanticSimilarity: conceptResult.semanticSimilarity
  });

  // Evaluate Ridge Regression Score
  const rawScore = predictRidgeScore(
    features,
    DEFAULT_RIDGE_WEIGHTS,
    DEFAULT_RIDGE_INTERCEPT
  );

  // Apply proctoring integrity multiplier
  const integrity = calculateIntegrityMultiplier(telemetry);
  const finalScore = Number((rawScore * integrity.multiplier).toFixed(2));

  // Compute Exact Linear SHAP values
  const linearShap = calculateLinearShapValues({
    features,
    weights: DEFAULT_RIDGE_WEIGHTS,
    intercept: DEFAULT_RIDGE_INTERCEPT,
    baseline: DEFAULT_RIDGE_BASELINE
  });

  // Generate Counterfactual feedback for missing / partial concepts
  const counterfactuals = generateConceptCounterfactuals({
    conceptCoverage: conceptResult,
    currentFeatures: features,
    currentScore: rawScore,
    weights: DEFAULT_RIDGE_WEIGHTS,
    intercept: DEFAULT_RIDGE_INTERCEPT,
    question
  });

  // Generate Model-Answer side-by-side diff
  const modelAnswerDiff = generateModelAnswerDiff(
    candidateAnswer,
    question.idealAnswer,
    conceptResult.concepts
  );

  return {
    score: finalScore,
    rawScore,
    integrityMultiplier: integrity.multiplier,
    penalties: integrity.penalties,
    model,
    promptVersion: RUBRIC_PROMPT_VERSION,
    rubric: {
      scores: rubricResult.rubricScores,
      details: rubricResult.dimensionDetails,
      variance: rubricResult.averageVariance,
      totalVariance: rubricResult.totalVariance,
      runCount: rubricResult.runCount
    },
    conceptCoverage: {
      concepts: conceptResult.concepts,
      coverageRatio: conceptResult.coverageRatio,
      coveredCount: conceptResult.coveredCount,
      partiallyCoveredCount: conceptResult.partiallyCoveredCount,
      missingCount: conceptResult.missingCount,
      totalConcepts: conceptResult.totalConcepts,
      semanticSimilarity: conceptResult.semanticSimilarity
    },
    features,
    shap: linearShap,
    counterfactuals,
    modelAnswerDiff,
    evaluatedAt: new Date().toISOString()
  };
}

export default {
  executeScoringPipeline,
  generateModelAnswerDiff,
  evaluateRubric,
  detectConceptCoverage,
  generateConceptCounterfactuals,
  RUBRIC_PROMPT_VERSION,
  CONCEPT_PROMPT_VERSION
};
