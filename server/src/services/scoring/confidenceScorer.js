/**
 * @file Per-Evaluation Confidence Scorer & Human Review Queue Dispatcher
 * Computes AI certainty based on rubric variance, concept coverage, answer depth, and proctoring integrity.
 * Automatically flags low-confidence or anomalous evaluations for human recruiter override.
 */

import { ReviewQueueItem } from '../../models/ReviewQueueItem.js';
import { logger } from '../../config/logger.js';

export const CONFIDENCE_THRESHOLDS = {
  HIGH: 0.85,
  MEDIUM: 0.70,
  HUMAN_REVIEW_TRIGGER: 0.70
};

/**
 * Computes a standardized per-evaluation AI confidence score (0.0 to 1.0).
 *
 * @param {Object} params
 * @param {number} [params.rubricVariance=0] - Variance across multi-pass rubric evaluations
 * @param {number} [params.conceptCoverageRatio=0.8] - Ratio of expected concepts detected (0 to 1)
 * @param {number} [params.wordCount=40] - Candidate answer word count
 * @param {number} [params.semanticSimilarity=0.8] - Cosine similarity against ideal benchmark
 * @param {number} [params.integrityScore=100] - Session integrity score (0 to 100)
 * @param {boolean} [params.isCoding=false] - Whether question had deterministic unit test execution
 * @returns {{
 *   confidenceScore: number,
 *   confidencePercentage: number,
 *   confidenceLevel: 'HIGH'|'MEDIUM'|'LOW',
 *   shouldFlagForHumanReview: boolean,
 *   flagReason: string,
 *   factors: Object
 * }}
 */
export function calculateEvaluationConfidence({
  rubricVariance = 0,
  conceptCoverageRatio = 0.8,
  wordCount = 40,
  semanticSimilarity = 0.8,
  integrityScore = 100,
  isCoding = false,
  evaluatedBy = 'llm'
}) {
  // If evaluated by heuristic offline scorer, confidence is strictly capped at 0.4
  if (evaluatedBy === 'heuristic') {
    const rawHeuristic = Math.min(
      0.40,
      Math.max(0.20, (wordCount / 50) * 0.30 + (semanticSimilarity || 0.5) * 0.15)
    );
    const finalConfidence = Number(rawHeuristic.toFixed(2));
    const confidencePercentage = Math.round(finalConfidence * 100);

    return {
      confidenceScore: finalConfidence,
      confidencePercentage,
      confidenceLevel: 'LOW',
      shouldFlagForHumanReview: true,
      flagReason:
        'Offline heuristic estimate (not AI-evaluated) - low confidence assessment queued for human review',
      evaluatedBy: 'heuristic',
      factors: {
        heuristicScorer: true,
        confidenceCap: 0.40
      }
    };
  }

  // If deterministic code execution passed with test cases, baseline confidence is high
  if (isCoding) {
    const codeConfidence = integrityScore < 75 ? 0.72 : 0.95;
    return {
      confidenceScore: codeConfidence,
      confidencePercentage: Math.round(codeConfidence * 100),
      confidenceLevel: codeConfidence >= 0.85 ? 'HIGH' : 'MEDIUM',
      shouldFlagForHumanReview: codeConfidence < CONFIDENCE_THRESHOLDS.HUMAN_REVIEW_TRIGGER,
      flagReason: codeConfidence < 0.70 ? 'Proctoring integrity anomalies during coding submission' : '',
      factors: { codeDeterministicPass: true, integrityDiscount: integrityScore < 75 }
    };
  }

  // 1. Rubric Variance factor: 0 variance = 1.0, variance 4.0 = 0.4
  const varianceFactor = Math.max(0.2, 1.0 - (rubricVariance / 5.0));

  // 2. Concept coverage clarity: closer to 0 or 1 is certain, ambiguous 0.4-0.6 is slightly less certain
  const coverageFactor = Math.min(1.0, Math.max(0.5, conceptCoverageRatio));

  // 3. Answer depth & substance factor: < 15 words penalizes confidence
  let lengthFactor = 1.0;
  if (wordCount < 15) lengthFactor = 0.60;
  else if (wordCount < 30) lengthFactor = 0.85;

  // 4. Semantic alignment factor
  const similarityFactor = Math.min(1.0, Math.max(0.5, semanticSimilarity));

  // 5. Integrity factor
  const integrityFactor = integrityScore < 75 ? 0.80 : 1.0;

  // Weighted composite confidence
  const rawScore =
    varianceFactor * 0.35 +
    coverageFactor * 0.25 +
    lengthFactor * 0.20 +
    similarityFactor * 0.20;

  const finalConfidence = Number(Math.min(0.99, Math.max(0.25, rawScore * integrityFactor)).toFixed(2));
  const confidencePercentage = Math.round(finalConfidence * 100);

  let confidenceLevel = 'MEDIUM';
  if (finalConfidence >= CONFIDENCE_THRESHOLDS.HIGH) confidenceLevel = 'HIGH';
  else if (finalConfidence < CONFIDENCE_THRESHOLDS.MEDIUM) confidenceLevel = 'LOW';

  const shouldFlagForHumanReview = finalConfidence < CONFIDENCE_THRESHOLDS.HUMAN_REVIEW_TRIGGER || integrityScore < 75;

  let flagReason = '';
  if (finalConfidence < CONFIDENCE_THRESHOLDS.HUMAN_REVIEW_TRIGGER) {
    flagReason = `Low AI evaluation certainty (${confidencePercentage}%) due to high rubric variance or sparse candidate response.`;
  } else if (integrityScore < 75) {
    flagReason = `Integrity proctoring score dropped to ${integrityScore}/100. Human review required.`;
  }

  return {
    confidenceScore: finalConfidence,
    confidencePercentage,
    confidenceLevel,
    shouldFlagForHumanReview,
    flagReason,
    evaluatedBy: 'llm',
    factors: {
      varianceFactor: Number(varianceFactor.toFixed(2)),
      coverageFactor: Number(coverageFactor.toFixed(2)),
      lengthFactor: Number(lengthFactor.toFixed(2)),
      similarityFactor: Number(similarityFactor.toFixed(2)),
      integrityFactor: Number(integrityFactor.toFixed(2))
    }
  };
}

/**
 * Dispatches flagged response to Human Review Queue.
 *
 * @param {Object} params
 * @param {string} params.sessionId
 * @param {string} params.questionId
 * @param {string} params.candidateId
 * @param {string} [params.candidateName]
 * @param {number} params.score
 * @param {number} params.confidenceScore
 * @param {string} params.candidateAnswer
 * @param {string} [params.triggerReason]
 * @param {Array<string>} [params.rubricEvidence]
 * @returns {Promise<Object>} Created review queue item
 */
export async function enqueueHumanReviewIfFlagged({
  sessionId,
  questionId,
  candidateId,
  candidateName = 'Candidate',
  score,
  confidenceScore,
  candidateAnswer,
  triggerReason = 'LOW_AI_CONFIDENCE',
  rubricEvidence = []
}) {
  try {
    const queueItem = await ReviewQueueItem.create({
      sessionId,
      questionId,
      candidateId,
      candidateName,
      triggerReason,
      severity: confidenceScore < 0.5 ? 'HIGH' : 'MEDIUM',
      originalScore: score,
      confidenceScore,
      candidateAnswer,
      rubricEvidence,
      status: 'pending'
    });

    logger.info(`📋 Dispatched response to Human Review Queue [Item ID: ${queueItem._id}]`);
    return queueItem;
  } catch (err) {
    logger.warn(`Failed to enqueue human review item: ${err.message}`);
    return null;
  }
}

export default {
  calculateEvaluationConfidence,
  enqueueHumanReviewIfFlagged,
  CONFIDENCE_THRESHOLDS
};