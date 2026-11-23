/**
 * @file Multi-Criteria Composite Scoring Model with Cosine Similarity & Integrity Penalties
 * Combines AI rubric dimensions, semantic embedding similarity, integrity/timing signals,
 * and statistical confidence intervals into a standardized 0-100 score.
 */

import { Matrix, inverse } from 'ml-matrix';

export const DEFAULT_RUBRIC_WEIGHTS = {
  technicalAccuracy: 0.35,
  conceptualDepth: 0.20,
  communication: 0.15,
  codeEfficiency: 0.15,
  problemSolving: 0.15
};

export const INTEGRITY_THRESHOLDS = {
  ALLOWED_TAB_SWITCHES: 2,
  PENALTY_PER_EXTRA_SWITCH: 0.05, // 5% deduction per extra blur
  MAX_TAB_PENALTY: 0.30,          // capped at 30% penalty
  MIN_TIME_PER_WORD_SEC: 0.10,    // 600 WPM indicates copy-paste
  MIN_RESPONSE_SECONDS: 4         // Minimum realistic thinking time for open-ended questions
};

/**
 * Computes cosine similarity between two numeric embedding vectors.
 *
 * Formula: (A . B) / (||A|| * ||B||)
 *
 * @param {number[]} vecA
 * @param {number[]} vecB
 * @returns {number} Cosine similarity in range [-1, 1], normalized to [0, 1]
 */
export function calculateCosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0 || vecA.length !== vecB.length) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA <= 0 || normB <= 0) return 0;

  const rawSim = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  // Normalize from [-1, 1] to [0, 1]
  const normalized = Math.max(0, Math.min(1, (rawSim + 1) / 2));
  return Number(normalized.toFixed(4));
}

/**
 * Calculates integrity multiplier based on proctoring telemetry (tab switches, typing anomalies).
 *
 * @param {Object} telemetry
 * @param {number} [telemetry.tabSwitches=0] - Number of times user blurred or switched tab
 * @param {number} [telemetry.durationSeconds=30] - Time taken to submit answer
 * @param {number} [telemetry.wordCount=0] - Number of words in answer
 * @param {boolean} [telemetry.pasteDetected=false] - Whether clipboard paste was flagged
 * @returns {{ multiplier: number, penalties: Array<{ reason: string, deduction: number }> }}
 */
export function calculateIntegrityMultiplier(telemetry = {}) {
  const {
    tabSwitches = 0,
    durationSeconds = 60,
    wordCount = 0,
    pasteDetected = false
  } = telemetry;

  let multiplier = 1.0;
  const penalties = [];

  // Tab switch penalty
  if (tabSwitches > INTEGRITY_THRESHOLDS.ALLOWED_TAB_SWITCHES) {
    const extra = tabSwitches - INTEGRITY_THRESHOLDS.ALLOWED_TAB_SWITCHES;
    const deduction = Math.min(
      INTEGRITY_THRESHOLDS.MAX_TAB_PENALTY,
      extra * INTEGRITY_THRESHOLDS.PENALTY_PER_EXTRA_SWITCH
    );
    multiplier -= deduction;
    penalties.push({
      reason: `Excessive window switches (${tabSwitches} switches detected)`,
      deduction: Number(deduction.toFixed(2))
    });
  }

  // Suspiciously fast response or massive paste detection
  if (wordCount > 30 && durationSeconds < INTEGRITY_THRESHOLDS.MIN_RESPONSE_SECONDS) {
    const deduction = 0.15;
    multiplier -= deduction;
    penalties.push({
      reason: 'Response submitted unusually fast for content length',
      deduction
    });
  } else if (pasteDetected && wordCount > 50 && durationSeconds < 10) {
    const deduction = 0.10;
    multiplier -= deduction;
    penalties.push({
      reason: 'Bulk clipboard paste detected without iterative typing',
      deduction
    });
  }

  multiplier = Math.max(0.5, Math.min(1.0, multiplier));

  return {
    multiplier: Number(multiplier.toFixed(2)),
    penalties
  };
}

/**
 * Evaluates candidate response using multi-criteria rubric and integrity signals.
 *
 * @param {Object} rubricScores - Scores on 0-10 scale for each criterion
 * @param {number} rubricScores.technicalAccuracy
 * @param {number} rubricScores.conceptualDepth
 * @param {number} rubricScores.communication
 * @param {number} [rubricScores.codeEfficiency]
 * @param {number} [rubricScores.problemSolving]
 * @param {Object} [options]
 * @param {Object} [options.weights] - Custom rubric weights (must sum to ~1.0)
 * @param {number} [options.semanticSimilarity] - Embedding cosine similarity [0, 1]
 * @param {Object} [options.telemetry] - Integrity telemetry
 * @returns {Object} Comprehensive scoring breakdown with confidence bounds
 */
export function computeCompositeScore(rubricScores, options = {}) {
  const weights = { ...DEFAULT_RUBRIC_WEIGHTS, ...(options.weights || {}) };

  // Normalize weights if needed
  const weightSum = Object.keys(weights).reduce((sum, key) => sum + (weights[key] || 0), 0);
  const normalizedWeights = {};
  for (const key of Object.keys(weights)) {
    normalizedWeights[key] = weightSum > 0 ? weights[key] / weightSum : 0.2;
  }

  // Calculate weighted rubric base score (scaled to 0-100)
  let rawScore = 0;
  const dimensionBreakdown = {};

  for (const [key, weight] of Object.entries(normalizedWeights)) {
    const scoreVal = Math.max(0, Math.min(10, rubricScores[key] ?? 5));
    const contribution = scoreVal * 10 * weight;
    rawScore += contribution;

    dimensionBreakdown[key] = {
      score: scoreVal,
      weight: Number(weight.toFixed(2)),
      contribution: Number(contribution.toFixed(2))
    };
  }

  // Blend with semantic similarity if provided (80% rubric, 20% semantic embedding match)
  let blendedScore = rawScore;
  if (typeof options.semanticSimilarity === 'number') {
    const simScore = Math.max(0, Math.min(1, options.semanticSimilarity)) * 100;
    blendedScore = rawScore * 0.8 + simScore * 0.2;
  }

  // Apply integrity penalties
  const integrity = calculateIntegrityMultiplier(options.telemetry);
  const finalScore = Number((blendedScore * integrity.multiplier).toFixed(2));

  // Compute confidence interval (+/- margin of error based on score dispersion)
  const scoresArray = Object.values(dimensionBreakdown).map((d) => d.score * 10);
  const mean = scoresArray.reduce((a, b) => a + b, 0) / scoresArray.length;
  const variance = scoresArray.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / scoresArray.length;
  const stdDev = Math.sqrt(variance);
  const margin = Number((stdDev * 0.5).toFixed(2));

  return {
    finalScore: Math.max(0, Math.min(100, finalScore)),
    rawScore: Number(rawScore.toFixed(2)),
    blendedScore: Number(blendedScore.toFixed(2)),
    integrityMultiplier: integrity.multiplier,
    penalties: integrity.penalties,
    dimensions: dimensionBreakdown,
    confidenceInterval: {
      lower: Number(Math.max(0, finalScore - margin).toFixed(2)),
      upper: Number(Math.min(100, finalScore + margin).toFixed(2)),
      margin
    }
  };
}

// -------------------------------------------------------------
// Ridge Regression Scoring Model & Feature Extraction
// -------------------------------------------------------------

/**
 * Default calibrated Ridge Regression weights across 7 feature dimensions.
 * Sum of weights = 10.0, scaling [0, 10] feature vector to [0, 100] target.
 */
export const DEFAULT_RIDGE_WEIGHTS = {
  correctness: 2.5,
  depth: 1.8,
  clarity: 1.2,
  completeness: 1.8,
  relevance: 1.2,
  conceptCoverage: 0.8,
  semanticSimilarity: 0.7
};

export const DEFAULT_RIDGE_INTERCEPT = 0.0;

/**
 * Standard benchmark candidate baseline profile E[X] (average candidate at 5.0 / 10).
 */
export const DEFAULT_RIDGE_BASELINE = {
  correctness: 5.0,
  depth: 5.0,
  clarity: 5.0,
  completeness: 5.0,
  relevance: 5.0,
  conceptCoverage: 5.0,
  semanticSimilarity: 5.0
};

/**
 * Feature Extractor: transforms raw rubric scores, concept coverage, and semantic similarity
 * into a standardized feature vector bounded to [0, 10].
 *
 * @param {Object} inputs
 * @param {Record<string, number>} [inputs.rubricScores={}]
 * @param {number} [inputs.conceptCoverageRatio=0.5] - Ratio of covered key concepts in [0, 1]
 * @param {number} [inputs.semanticSimilarity=0.5] - Cosine similarity in [0, 1]
 * @returns {Record<string, number>} Normalized feature vector x
 */
export function extractScoringFeatures({
  rubricScores = {},
  conceptCoverageRatio = 0.5,
  semanticSimilarity = 0.5
} = {}) {
  return {
    correctness: Number(Math.max(0, Math.min(10, rubricScores.correctness ?? 5.0)).toFixed(2)),
    depth: Number(Math.max(0, Math.min(10, rubricScores.depth ?? 5.0)).toFixed(2)),
    clarity: Number(Math.max(0, Math.min(10, rubricScores.clarity ?? 5.0)).toFixed(2)),
    completeness: Number(Math.max(0, Math.min(10, rubricScores.completeness ?? 5.0)).toFixed(2)),
    relevance: Number(Math.max(0, Math.min(10, rubricScores.relevance ?? 5.0)).toFixed(2)),
    conceptCoverage: Number(Math.max(0, Math.min(10, (conceptCoverageRatio ?? 0.5) * 10)).toFixed(2)),
    semanticSimilarity: Number(Math.max(0, Math.min(10, (semanticSimilarity ?? 0.5) * 10)).toFixed(2))
  };
}

/**
 * Predicts candidate score using the Ridge Regression model.
 *
 * Formula: y_hat = beta_0 + sum_j (beta_j * x_j)
 *
 * @param {Record<string, number>} features - Normalized feature vector [0, 10]
 * @param {Record<string, number>} [weights=DEFAULT_RIDGE_WEIGHTS] - Regression weights
 * @param {number} [intercept=DEFAULT_RIDGE_INTERCEPT] - Model intercept
 * @returns {number} Predicted score in range [0, 100]
 */
export function predictRidgeScore(
  features,
  weights = DEFAULT_RIDGE_WEIGHTS,
  intercept = DEFAULT_RIDGE_INTERCEPT
) {
  let score = intercept;
  for (const [key, weight] of Object.entries(weights)) {
    const val = features[key] ?? DEFAULT_RIDGE_BASELINE[key] ?? 5.0;
    score += weight * val;
  }
  return Number(Math.max(0, Math.min(100, score)).toFixed(2));
}

/**
 * Trains/fits a Ridge Regression model from training data with L2 regularization.
 *
 * Formula: beta = (X^T * X + lambda * I)^(-1) * X^T * y
 *
 * @param {number[][]} X - Feature matrix (N samples x M features)
 * @param {number[]} y - Target scores vector (N samples)
 * @param {Object} [options]
 * @param {number} [options.lambda=1.0] - L2 regularization coefficient
 * @param {boolean} [options.fitIntercept=true] - Whether to fit an intercept column
 * @returns {{ weights: number[], intercept: number }}
 */
export function fitRidgeRegression(X, y, options = {}) {
  const { lambda = 1.0, fitIntercept = true } = options;

  const n = X.length;
  const m = X[0].length;

  let X_mat;
  if (fitIntercept) {
    // Augment with column of 1s
    const augmented = X.map((row) => [1, ...row]);
    X_mat = new Matrix(augmented);
  } else {
    X_mat = new Matrix(X);
  }

  const y_mat = Matrix.columnVector(y);
  const p = X_mat.columns;

  const Xt = X_mat.transpose();
  const XtX = Xt.mmul(X_mat);

  // L2 regularization matrix: lambda * I (skip penalty on intercept if fitted)
  const penalty = Matrix.eye(p, p).mul(lambda);
  if (fitIntercept) {
    penalty.set(0, 0, 0); // No regularization on bias term
  }

  const ridgeMatrix = XtX.add(penalty);
  const inv = inverse(ridgeMatrix);
  const betaMat = inv.mmul(Xt).mmul(y_mat);
  const beta = betaMat.to1DArray();

  if (fitIntercept) {
    return {
      intercept: Number(beta[0].toFixed(4)),
      weights: beta.slice(1).map((w) => Number(w.toFixed(4)))
    };
  }

  return {
    intercept: 0,
    weights: beta.map((w) => Number(w.toFixed(4)))
  };
}
