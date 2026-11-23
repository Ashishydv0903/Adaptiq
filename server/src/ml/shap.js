/**
 * @file Explainable AI (XAI) Feature Attribution via Exact Shapley Values (SHAP) & Counterfactuals
 * Computes cooperative game theoretic Shapley values for rubric dimensions,
 * verifies the efficiency axiom (sum of phi_i = f(x) - E[f(x)]), and generates
 * actionable counterfactual improvement recommendations.
 */

import { computeCompositeScore } from './scoringModel.js';

// Default baseline rubric representative of average candidate benchmark
export const DEFAULT_BASELINE_RUBRIC = {
  technicalAccuracy: 5.0,
  conceptualDepth: 5.0,
  communication: 5.0,
  codeEfficiency: 5.0,
  problemSolving: 5.0
};

/**
 * Generates all subsets (power set) of an array of feature names.
 *
 * @param {string[]} features
 * @returns {string[][]}
 */
function getPowerSet(features) {
  const result = [[]];
  for (const feature of features) {
    const len = result.length;
    for (let i = 0; i < len; i++) {
      result.push([...result[i], feature]);
    }
  }
  return result;
}

/**
 * Calculates factorial n!
 * @param {number} n
 * @returns {number}
 */
function factorial(n) {
  if (n <= 1) return 1;
  let res = 1;
  for (let i = 2; i <= n; i++) res *= i;
  return res;
}

/**
 * Computes exact Shapley values (SHAP attributions) for scoring model features.
 *
 * Formula:
 * phi_i = sum_{S subset F \ {i}} [ |S|! (|F| - |S| - 1)! / |F|! ] * [ v(S U {i}) - v(S) ]
 *
 * Satisfies the Efficiency Axiom: sum(phi_i) === f(instance) - f(baseline)
 *
 * @param {Object} candidateRubric - Candidate's rubric scores (e.g. { technicalAccuracy: 8, ... })
 * @param {Object} [baselineRubric=DEFAULT_BASELINE_RUBRIC] - Expected benchmark baseline
 * @param {Function} [evaluationFn] - Value function mapping rubric to numeric score
 * @returns {Object} SHAP attribution breakdown and waterfall steps
 */
export function calculateShapleyAttributions(
  candidateRubric,
  baselineRubric = DEFAULT_BASELINE_RUBRIC,
  evaluationFn = null
) {
  const features = Object.keys(candidateRubric);
  const n = features.length;

  // Default evaluation function uses composite score raw score
  const evalModel = evaluationFn || ((rubric) => computeCompositeScore(rubric).rawScore);

  const baselineScore = Number(evalModel(baselineRubric).toFixed(2));
  const candidateScore = Number(evalModel(candidateRubric).toFixed(2));
  const totalDifference = Number((candidateScore - baselineScore).toFixed(2));

  // Pre-calculate evaluation for each subset coalition
  // Hybrid instance: uses candidate's value if feature in coalition S, else baseline value
  const coalitionCache = new Map();

  const evaluateCoalition = (coalition) => {
    const key = [...coalition].sort().join(',');
    if (coalitionCache.has(key)) return coalitionCache.get(key);

    const hybrid = {};
    for (const f of features) {
      hybrid[f] = coalition.includes(f) ? candidateRubric[f] : baselineRubric[f];
    }
    const val = evalModel(hybrid);
    coalitionCache.set(key, val);
    return val;
  };

  const attributions = {};
  const nFactorial = factorial(n);

  for (const feature of features) {
    const otherFeatures = features.filter((f) => f !== feature);
    const subCoalitions = getPowerSet(otherFeatures);

    let phi = 0;

    for (const s of subCoalitions) {
      const sSize = s.length;
      // Combinatorial weight |S|! * (|F| - |S| - 1)! / |F|!
      const weight = (factorial(sSize) * factorial(n - sSize - 1)) / nFactorial;

      const scoreWithout = evaluateCoalition(s);
      const scoreWith = evaluateCoalition([...s, feature]);
      const marginalContribution = scoreWith - scoreWithout;

      phi += weight * marginalContribution;
    }

    attributions[feature] = Number(phi.toFixed(2));
  }

  // Construct waterfall explanation
  let currentRunningScore = baselineScore;
  const waterfall = [
    {
      step: 'Baseline Benchmark',
      delta: 0,
      runningScore: baselineScore
    }
  ];

  const sortedFeatures = Object.entries(attributions).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));

  for (const [feat, phi] of sortedFeatures) {
    currentRunningScore = Number((currentRunningScore + phi).toFixed(2));
    waterfall.push({
      step: feat,
      delta: phi,
      runningScore: currentRunningScore,
      impact: phi >= 0 ? 'positive' : 'negative'
    });
  }

  // Percentage breakdown of variance explained
  const totalAbsoluteAttribution = Object.values(attributions).reduce((sum, val) => sum + Math.abs(val), 0);
  const relativeImportance = {};

  for (const [feat, phi] of Object.entries(attributions)) {
    relativeImportance[feat] = totalAbsoluteAttribution > 0
      ? Number(((Math.abs(phi) / totalAbsoluteAttribution) * 100).toFixed(1))
      : 0;
  }

  return {
    baselineScore,
    candidateScore,
    totalDifference,
    attributions,
    relativeImportance,
    waterfall,
    // Verify efficiency property
    efficiencyCheck: {
      sumOfShapley: Number(Object.values(attributions).reduce((a, b) => a + b, 0).toFixed(2)),
      actualDelta: totalDifference,
      isBalanced: Math.abs(
        Object.values(attributions).reduce((a, b) => a + b, 0) - totalDifference
      ) < 0.05
    }
  };
}

/**
 * Calculates exact Linear SHAP values for linear and ridge regression scoring models.
 *
 * For a linear model f(x) = beta_0 + sum_j (beta_j * x_j):
 * The exact Shapley feature attribution phi_j with baseline E[X] is:
 *   phi_j = beta_j * (x_j - E[X_j])
 *
 * Guaranteed to satisfy the Efficiency Axiom with exact machine precision:
 *   sum_j phi_j === f(x) - f(E[X])
 *
 * @param {Object} params
 * @param {Record<string, number>} params.features - Candidate's feature vector x
 * @param {Record<string, number>} params.weights - Model regression coefficients beta_j
 * @param {number} [params.intercept=0] - Model intercept beta_0
 * @param {Record<string, number>} [params.baseline] - Expected baseline benchmark E[X]
 * @returns {Object} Exact linear SHAP attributions and waterfall steps
 */
export function calculateLinearShapValues({
  features,
  weights,
  intercept = 0,
  baseline = {}
}) {
  const featureKeys = Object.keys(weights);

  // Evaluate baseline benchmark score f(E[X])
  let baselineScore = intercept;
  for (const key of featureKeys) {
    const baseVal = baseline[key] ?? 5.0;
    const beta = weights[key] ?? 0;
    baselineScore += beta * baseVal;
  }
  baselineScore = Number(baselineScore.toFixed(2));

  // Evaluate candidate instance score f(x)
  let candidateScore = intercept;
  for (const key of featureKeys) {
    const featVal = features[key] ?? baseline[key] ?? 5.0;
    const beta = weights[key] ?? 0;
    candidateScore += beta * featVal;
  }
  candidateScore = Number(candidateScore.toFixed(2));

  const totalDifference = Number((candidateScore - baselineScore).toFixed(2));

  // Exact linear SHAP: phi_j = beta_j * (x_j - E[X_j])
  const attributions = {};
  let sumOfShapley = 0;

  for (const key of featureKeys) {
    const featVal = features[key] ?? baseline[key] ?? 5.0;
    const baseVal = baseline[key] ?? 5.0;
    const beta = weights[key] ?? 0;

    const phi = beta * (featVal - baseVal);
    const roundedPhi = Number(phi.toFixed(2));
    attributions[key] = roundedPhi;
    sumOfShapley += phi;
  }

  sumOfShapley = Number(sumOfShapley.toFixed(2));

  // Construct waterfall explanation
  let currentRunningScore = baselineScore;
  const waterfall = [
    {
      step: 'Baseline Benchmark',
      delta: 0,
      runningScore: baselineScore
    }
  ];

  const sortedFeatures = Object.entries(attributions).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));

  for (const [feat, phi] of sortedFeatures) {
    currentRunningScore = Number((currentRunningScore + phi).toFixed(2));
    waterfall.push({
      step: feat,
      delta: phi,
      runningScore: currentRunningScore,
      impact: phi >= 0 ? 'positive' : 'negative'
    });
  }

  // Relative importance (% of absolute variance explained)
  const totalAbsoluteAttribution = Object.values(attributions).reduce((sum, val) => sum + Math.abs(val), 0);
  const relativeImportance = {};

  for (const [feat, phi] of Object.entries(attributions)) {
    relativeImportance[feat] = totalAbsoluteAttribution > 0
      ? Number(((Math.abs(phi) / totalAbsoluteAttribution) * 100).toFixed(1))
      : 0;
  }

  return {
    baselineScore,
    predictedScore: candidateScore,
    totalDifference,
    attributions,
    relativeImportance,
    waterfall,
    efficiencyCheck: {
      sumOfShapley,
      actualDelta: totalDifference,
      isBalanced: Math.abs(sumOfShapley - totalDifference) < 0.05
    }
  };
}

/**
 * Generates Counterfactual "What-If" Recommendations.
 * Simulates the effect of targeted skill score increases on the overall evaluation.
 *
 * @param {Object} currentRubric - Candidate's current rubric scores
 * @param {Object} [options]
 * @param {number} [options.targetDelta=2.0] - Hypothetical score increment to test
 * @param {number} [options.targetGoalScore=80.0] - Target passing/distinction score
 * @returns {Array<{ dimension: string, currentScore: number, simulatedScore: number, potentialGain: number, recommendation: string }>}
 */
export function generateCounterfactualRecommendations(currentRubric, options = {}) {
  const { targetDelta = 2.0, targetGoalScore = 80.0 } = options;
  const baseResult = computeCompositeScore(currentRubric);
  const currentFinal = baseResult.rawScore;

  const recommendations = [];

  for (const [dimension, currentVal] of Object.entries(currentRubric)) {
    if (currentVal >= 9.5) continue; // Already near maximum

    const simulatedVal = Math.min(10.0, currentVal + targetDelta);
    const hypotheticalRubric = { ...currentRubric, [dimension]: simulatedVal };
    const simulatedResult = computeCompositeScore(hypotheticalRubric);
    const potentialGain = Number((simulatedResult.rawScore - currentFinal).toFixed(2));

    const reachesGoal = simulatedResult.rawScore >= targetGoalScore;

    let recommendation = `Increasing ${dimension} from ${currentVal}/10 to ${simulatedVal}/10 would boost your score by +${potentialGain} points to ${simulatedResult.rawScore}/100.`;
    if (reachesGoal && currentFinal < targetGoalScore) {
      recommendation += ` This would successfully cross the target threshold of ${targetGoalScore}!`;
    }

    recommendations.push({
      dimension,
      currentScore: currentVal,
      simulatedScore: simulatedVal,
      potentialGain,
      newProjectedScore: simulatedResult.rawScore,
      recommendation
    });
  }

  // Sort by potential leverage (highest gain first)
  recommendations.sort((a, b) => b.potentialGain - a.potentialGain);

  return recommendations;
}
