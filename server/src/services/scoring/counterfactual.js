import { predictRidgeScore, DEFAULT_RIDGE_WEIGHTS, DEFAULT_RIDGE_INTERCEPT } from '../../ml/scoringModel.js';
import { PROMPT_VERSIONS } from '../llm/index.js';

export const COUNTERFACTUAL_VERSION = PROMPT_VERSIONS.COUNTERFACTUAL;

/**
 * Generates counterfactual feedback by simulating the effect of addressing each missing or partial concept
 * on the Ridge Regression scoring model.
 *
 * @param {Object} params
 * @param {Object} params.conceptCoverage - Output from detectConceptCoverage
 * @param {Record<string, number>} params.currentFeatures - Current normalized [0, 10] features
 * @param {number} params.currentScore - Current predicted score [0, 100]
 * @param {Record<string, number>} [params.weights=DEFAULT_RIDGE_WEIGHTS] - Model weights
 * @param {number} [params.intercept=DEFAULT_RIDGE_INTERCEPT] - Model intercept
 * @param {Object} [params.question] - Question details
 * @returns {Array<Object>} List of actionable counterfactual recommendations sorted by gain
 */
export function generateConceptCounterfactuals({
  conceptCoverage,
  currentFeatures,
  currentScore,
  weights = DEFAULT_RIDGE_WEIGHTS,
  intercept = DEFAULT_RIDGE_INTERCEPT,
  question = {}
}) {
  const recommendations = [];
  const totalConcepts = Math.max(1, conceptCoverage.totalConcepts || 1);
  const candidateConcepts = conceptCoverage.concepts || [];

  for (const item of candidateConcepts) {
    if (item.status === 'covered') {
      continue; // Concept already mastered
    }

    // Determine simulation delta in coverage
    const coverageBoostRatio = item.status === 'missing' ? 1.0 / totalConcepts : 0.5 / totalConcepts;
    const currentCoverageRatio = (currentFeatures.conceptCoverage ?? 5.0) / 10.0;
    const simulatedCoverageRatio = Math.min(1.0, currentCoverageRatio + coverageBoostRatio);

    // Simulate gains in completeness and depth that addressing this concept would confer
    const currentCompleteness = currentFeatures.completeness ?? 5.0;
    const simulatedCompleteness = Math.min(10.0, currentCompleteness + (item.status === 'missing' ? 1.5 : 0.8));

    const currentDepth = currentFeatures.depth ?? 5.0;
    const simulatedDepth = Math.min(10.0, currentDepth + (item.status === 'missing' ? 1.0 : 0.5));

    const currentSim = currentFeatures.semanticSimilarity ?? 5.0;
    const simulatedSim = Math.min(10.0, currentSim + 0.8);

    // Build simulated feature vector
    const simulatedFeatures = {
      ...currentFeatures,
      conceptCoverage: Number((simulatedCoverageRatio * 10).toFixed(2)),
      completeness: Number(simulatedCompleteness.toFixed(2)),
      depth: Number(simulatedDepth.toFixed(2)),
      semanticSimilarity: Number(simulatedSim.toFixed(2))
    };

    const simulatedScore = predictRidgeScore(simulatedFeatures, weights, intercept);
    const potentialGain = Number(Math.max(0, simulatedScore - currentScore).toFixed(2));

    const statusLabel = item.status === 'missing' ? 'mentioning' : 'explaining more about';
    const pointsDelta = Math.round(potentialGain);
    const recommendation = `Explain ${item.concept} to gain around +${pointsDelta} points on this question.`;
    const actionableSuggestion = `Mention ${item.concept} and briefly explain how you would use it.`;

    recommendations.push({
      concept: item.concept,
      currentStatus: item.status,
      potentialGain,
      pointsDelta,
      simulatedScore,
      currentScore,
      recommendation,
      actionableSuggestion,
      explanation: item.explanation || `Add a clear explanation of ${item.concept}.`,
      simulatedFeatures
    });
  }

  // Sort by potential leverage (highest score gain first)
  recommendations.sort((a, b) => b.potentialGain - a.potentialGain);

  return recommendations;
}

export default {
  generateConceptCounterfactuals,
  COUNTERFACTUAL_VERSION
};
