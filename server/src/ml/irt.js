/**
 * @file Item Response Theory (IRT) Engine for AdaptIQ
 * Implements 1PL (Rasch), 2PL, and 3PL logistic models, Fisher Information,
 * Newton-Raphson & EAP ability (theta) estimation, Standard Error of Measurement (SEM),
 * and adaptive question selection with topic-balance, exposure control, and stopping rules.
 */

export const IRT_DEFAULTS = {
  MIN_THETA: -4.0,
  MAX_THETA: 4.0,
  INITIAL_THETA: 0.0,
  INITIAL_SEM: 1.0,
  CONVERGENCE_EPSILON: 1e-4,
  MAX_ITERATIONS: 25,
  DAMPING_FACTOR: 0.5,
  TARGET_SEM: 0.30,
  MAX_QUESTIONS: 20,
  MIN_QUESTIONS: 5
};

/**
 * Calculates item response probability P(theta) under 1PL, 2PL, or 3PL model.
 *
 * 3PL Formula: P(theta) = c + (1 - c) / (1 + exp(-a * (theta - b)))
 *
 * @param {number} theta - Candidate latent ability (-4 to +4)
 * @param {number} b - Item difficulty parameter (-4 to +4)
 * @param {number} [a=1.0] - Item discrimination parameter (typically 0.5 to 2.5)
 * @param {number} [c=0.0] - Pseudo-guessing parameter (typically 0.0 to 0.25)
 * @returns {number} Probability of a correct response (in range [c, 1])
 */
export function calculateProbability(theta, b, a = 1.0, c = 0.0) {
  // Clamp extreme exponent values to prevent overflow/underflow
  const linear = a * (theta - b);
  const clampedLinear = Math.max(-30, Math.min(30, linear));
  const expTerm = Math.exp(-clampedLinear);
  const logistic = 1 / (1 + expTerm);

  return c + (1 - c) * logistic;
}

/**
 * Calculates Fisher Item Information I_i(theta).
 *
 * Formula: I_i(theta) = a^2 * (P - c)^2 * (1 - P) / ((1 - c)^2 * P)
 *
 * When c = 0 (1PL / 2PL): I_i(theta) = a^2 * P * (1 - P)
 *
 * @param {number} theta - Candidate latent ability
 * @param {number} b - Item difficulty
 * @param {number} [a=1.0] - Item discrimination
 * @param {number} [c=0.0] - Pseudo-guessing parameter
 * @returns {number} Item information value
 */
export function calculateItemInformation(theta, b, a = 1.0, c = 0.0) {
  const p = calculateProbability(theta, b, a, c);

  if (p <= 0 || p >= 1) return 0;

  if (c <= 0) {
    return a * a * p * (1 - p);
  }

  const numerator = a * a * Math.pow(p - c, 2) * (1 - p);
  const denominator = Math.pow(1 - c, 2) * p;

  return denominator === 0 ? 0 : numerator / denominator;
}

/**
 * Calculates Test Information Function (TIF) across a set of administered items.
 *
 * Formula: I(theta) = sum(I_i(theta))
 *
 * @param {number} theta - Candidate latent ability
 * @param {Array<{ b: number, a?: number, c?: number }>} items - Administered items
 * @returns {number} Total test information
 */
export function calculateTestInformation(theta, items) {
  if (!items || items.length === 0) return 0;
  return items.reduce((sum, item) => {
    return sum + calculateItemInformation(theta, item.b, item.a ?? 1.0, item.c ?? 0.0);
  }, 0);
}

/**
 * Calculates Standard Error of Measurement (SEM) at a given ability theta.
 *
 * Formula: SEM(theta) = 1 / sqrt(I(theta))
 *
 * @param {number} theta - Latent ability
 * @param {Array<{ b: number, a?: number, c?: number }>} items - Administered items
 * @returns {number} Standard error of measurement
 */
export function calculateSEM(theta, items) {
  const info = calculateTestInformation(theta, items);
  if (info <= 0.0001) return IRT_DEFAULTS.INITIAL_SEM;
  return 1 / Math.sqrt(info);
}

/**
 * Estimates latent ability (theta) using Newton-Raphson Maximum Likelihood Estimation (MLE).
 * Includes step damping and boundaries clamping [-4, 4].
 *
 * @param {Array<{ b: number, a?: number, c?: number, score: number }>} responses - Administered items with score (0 or 1)
 * @param {number} [initialTheta=0.0] - Starting theta estimate
 * @returns {{ theta: number, sem: number, converged: boolean, iterations: number }}
 */
export function estimateAbilityMLE(responses, initialTheta = IRT_DEFAULTS.INITIAL_THETA) {
  if (!responses || responses.length === 0) {
    return {
      theta: initialTheta,
      sem: IRT_DEFAULTS.INITIAL_SEM,
      converged: true,
      iterations: 0
    };
  }

  const scores = responses.map((r) => (r.score >= 0.5 ? 1 : 0));
  const allCorrect = scores.every((s) => s === 1);
  const allIncorrect = scores.every((s) => s === 0);

  // MLE undefined for all 0s or all 1s (infinite likelihood peak). Use Bayesian prior or heuristic clamping
  if (allCorrect) {
    const maxB = Math.max(...responses.map((r) => r.b));
    const theta = Math.min(IRT_DEFAULTS.MAX_THETA, maxB + 0.8);
    return {
      theta,
      sem: calculateSEM(theta, responses),
      converged: true,
      iterations: 0
    };
  }

  if (allIncorrect) {
    const minB = Math.min(...responses.map((r) => r.b));
    const theta = Math.max(IRT_DEFAULTS.MIN_THETA, minB - 0.8);
    return {
      theta,
      sem: calculateSEM(theta, responses),
      converged: true,
      iterations: 0
    };
  }

  let theta = initialTheta;
  let iterations = 0;
  let converged = false;

  for (let i = 0; i < IRT_DEFAULTS.MAX_ITERATIONS; i++) {
    iterations++;

    let firstDerivative = 0;
    let secondDerivative = 0;

    for (const r of responses) {
      const a = r.a ?? 1.0;
      const b = r.b;
      const c = r.c ?? 0.0;
      const u = r.score >= 0.5 ? 1 : 0;

      const p = calculateProbability(theta, b, a, c);
      const q = 1 - p;

      if (p <= 0 || q <= 0) continue;

      // First derivative of log-likelihood
      const dP_dTheta = a * ((p - c) / (1 - c)) * q;
      const term1 = ((u - p) / (p * q)) * dP_dTheta;
      firstDerivative += term1;

      // Second derivative approximation (negative of Fisher Information)
      const info = calculateItemInformation(theta, b, a, c);
      secondDerivative -= info;
    }

    if (Math.abs(secondDerivative) < 1e-6) {
      break;
    }

    const delta = -firstDerivative / secondDerivative;
    // Step damping to avoid divergence
    const dampedDelta = Math.max(-1.0, Math.min(1.0, delta * IRT_DEFAULTS.DAMPING_FACTOR));
    theta += dampedDelta;

    // Clamp to bounds
    theta = Math.max(IRT_DEFAULTS.MIN_THETA, Math.min(IRT_DEFAULTS.MAX_THETA, theta));

    if (Math.abs(delta) < IRT_DEFAULTS.CONVERGENCE_EPSILON) {
      converged = true;
      break;
    }
  }

  const sem = calculateSEM(theta, responses);

  return {
    theta: Number(theta.toFixed(4)),
    sem: Number(sem.toFixed(4)),
    converged,
    iterations
  };
}

/**
 * Estimates latent ability using Expected A Posteriori (EAP) Bayesian estimation
 * with standard normal prior N(0, 1) over a quadrature grid [-4, 4].
 * Always produces stable finite estimates even for all 0s / all 1s.
 *
 * @param {Array<{ b: number, a?: number, c?: number, score: number }>} responses
 * @param {number} [quadraturePoints=81] - Number of integration points from -4 to +4 (step 0.1)
 * @returns {{ theta: number, sem: number }}
 */
export function estimateAbilityEAP(responses, quadraturePoints = 81) {
  if (!responses || responses.length === 0) {
    return { theta: 0.0, sem: 1.0 };
  }

  const minX = -4.0;
  const maxX = 4.0;
  const step = (maxX - minX) / (quadraturePoints - 1);

  let numerator = 0;
  let denominator = 0;
  let varianceNumerator = 0;

  const points = [];
  const likelihoods = [];

  for (let i = 0; i < quadraturePoints; i++) {
    const x = minX + i * step;
    points.push(x);

    // Standard normal prior: (1 / sqrt(2 * pi)) * exp(-x^2 / 2)
    const prior = (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * x * x);

    // Log-likelihood L(X) = prod(P_i^u * (1 - P_i)^(1-u))
    let logLikelihood = 0;
    for (const r of responses) {
      const a = r.a ?? 1.0;
      const b = r.b;
      const c = r.c ?? 0.0;
      const u = r.score >= 0.5 ? 1 : 0;
      const p = calculateProbability(x, b, a, c);
      const safeP = Math.max(1e-7, Math.min(1 - 1e-7, p));

      logLikelihood += u * Math.log(safeP) + (1 - u) * Math.log(1 - safeP);
    }

    const likelihood = Math.exp(logLikelihood) * prior;
    likelihoods.push(likelihood);

    numerator += x * likelihood * step;
    denominator += likelihood * step;
  }

  if (denominator <= 1e-12) {
    return estimateAbilityMLE(responses);
  }

  const theta = numerator / denominator;

  for (let i = 0; i < quadraturePoints; i++) {
    const x = points[i];
    const diff = x - theta;
    varianceNumerator += diff * diff * likelihoods[i] * step;
  }

  const posteriorVariance = varianceNumerator / denominator;
  const sem = Math.sqrt(Math.max(0.01, posteriorVariance));

  return {
    theta: Number(Math.max(-4, Math.min(4, theta)).toFixed(4)),
    sem: Number(sem.toFixed(4))
  };
}

/**
 * Checks whether an adaptive interview session meets termination criteria.
 * Stopping rule: Standard Error (SE) < 0.30 (target precision) or 20 questions maximum.
 *
 * @param {Array<any>} responses - Administered question responses
 * @param {number} currentSEM - Current standard error of measurement
 * @param {Object} [options]
 * @param {number} [options.maxQuestions=20] - Maximum test length
 * @param {number} [options.targetSEM=0.30] - Precision target
 * @param {number} [options.minQuestions=5] - Minimum questions before early precision stop
 * @returns {{ shouldStop: boolean, reason: 'MAX_QUESTIONS_REACHED'|'TARGET_PRECISION_REACHED'|'CONTINUE', questionsAsked: number }}
 */
export function shouldStopAdaptiveTest(responses = [], currentSEM = 1.0, options = {}) {
  const maxQuestions = options.maxQuestions ?? IRT_DEFAULTS.MAX_QUESTIONS;
  const targetSEM = options.targetSEM ?? IRT_DEFAULTS.TARGET_SEM;
  const minQuestions = options.minQuestions ?? IRT_DEFAULTS.MIN_QUESTIONS;

  const count = responses.length;

  if (count >= maxQuestions) {
    return { shouldStop: true, reason: 'MAX_QUESTIONS_REACHED', questionsAsked: count };
  }

  if (count >= minQuestions && currentSEM <= targetSEM) {
    return { shouldStop: true, reason: 'TARGET_PRECISION_REACHED', questionsAsked: count };
  }

  return { shouldStop: false, reason: 'CONTINUE', questionsAsked: count };
}

/**
 * Selects the optimal next question from candidate pool using Maximum Fisher Information (MFI)
 * subject to topic-balance constraints and exposure control (randomesque selection among top-k items).
 *
 * @param {number} currentTheta - Current estimated candidate ability
 * @param {Array<{ id: string, b: number, a?: number, c?: number, skillId?: string, topic?: string }>} pool - Available questions
 * @param {Array<string|{ questionId?: string, id?: string, skillId?: string, topic?: string }>} [administeredItems=[]] - Questions already administered
 * @param {Object} [options]
 * @param {number} [options.topK=3] - Randomesque selection pool size for exposure control
 * @param {string} [options.targetSkillId] - Optional skill filtering
 * @param {number} [options.bWindow=2.5] - Allowed difficulty window around theta
 * @param {boolean} [options.enforceTopicBalance=true] - Whether to diversify question topics
 * @returns {Object|null} Selected item or null if pool is exhausted
 */
export function selectNextQuestion(
  currentTheta,
  pool,
  administeredItems = [],
  options = {}
) {
  const {
    topK = 3,
    targetSkillId = null,
    bWindow = 2.5,
    enforceTopicBalance = true
  } = options;

  // Extract administered IDs and topic usage frequency
  const administeredSet = new Set();
  const topicCounts = new Map();

  for (const entry of administeredItems) {
    const id = typeof entry === 'string' ? entry : (entry?.questionId || entry?.id || entry?._id?.toString());
    if (id) administeredSet.add(id);

    const topic = entry?.topic || entry?.skillId || entry?.skills?.[0]?.toString();
    if (topic) {
      topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
    }
  }

  // Filter unasked questions
  let candidates = pool.filter((item) => {
    const itemId = item.id || item._id?.toString();
    return !administeredSet.has(itemId);
  });

  if (targetSkillId) {
    const skillFiltered = candidates.filter((item) => {
      const sId = item.skillId || item.skills?.[0]?.toString() || item.skillSlug;
      return sId === targetSkillId;
    });
    if (skillFiltered.length > 0) {
      candidates = skillFiltered;
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  // Difficulty window filtering
  const windowFiltered = candidates.filter((item) => Math.abs(item.b - currentTheta) <= bWindow);
  const eligibleItems = windowFiltered.length > 0 ? windowFiltered : candidates;

  // Score candidate items based on Fisher Information and Topic Balance
  const scoredItems = eligibleItems.map((item) => {
    const info = calculateItemInformation(currentTheta, item.b, item.a ?? 1.0, item.c ?? 0.0);

    let topicPenalty = 1.0;
    if (enforceTopicBalance) {
      const itemTopic = item.topic || item.skillId || item.skills?.[0]?.toString() || item.skillSlug;
      const timesAsked = itemTopic ? (topicCounts.get(itemTopic) || 0) : 0;
      // Inverse frequency dampening: 1 / (1 + timesAsked)
      topicPenalty = 1.0 / (1.0 + timesAsked * 0.5);
    }

    const compositeScore = info * topicPenalty;

    return {
      item,
      information: info,
      compositeScore
    };
  });

  // Sort descending by composite score (MFI with topic balance)
  scoredItems.sort((x, y) => y.compositeScore - x.compositeScore);

  // Exposure control: Randomesque selection among top-k items
  const k = Math.min(topK, scoredItems.length);
  const selectedIndex = Math.floor(Math.random() * k);

  return scoredItems[selectedIndex].item;
}

/**
 * Converts latent ability theta (-4 to +4) into standard human-readable score (0 to 100)
 * using standard normal cumulative distribution function (CDF).
 *
 * @param {number} theta - Latent ability
 * @returns {number} Score from 0 to 100
 */
export function thetaToPercentileScore(theta) {
  // Approximation of standard normal CDF
  const z = Math.max(-4, Math.min(4, theta));
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  let p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));

  if (z > 0) p = 1 - p;

  return Number((p * 100).toFixed(1));
}
