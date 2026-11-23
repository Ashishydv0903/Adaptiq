/**
 * @file Skill Mastery Engine using Bayesian Knowledge Tracing (BKT) & Forgetting Curves
 * Models candidate knowledge state, handles real-time probability updates based on
 * correct/incorrect performance, propagates mastery across prerequisite skill graphs,
 * and calculates time-based retention decay.
 */

export const BKT_DEFAULT_PARAMS = {
  pL0: 0.20, // Prior probability of knowing the skill initially
  pT: 0.15,  // Transition probability (learning rate per step)
  pG: 0.15,  // Guess probability (answering correctly without knowing)
  pS: 0.10   // Slip probability (making mistake despite knowing)
};

export const MASTERY_LEVELS = {
  NOVICE: 'Novice',           // P(L) < 0.40
  DEVELOPING: 'Developing',   // 0.40 <= P(L) < 0.65
  COMPETENT: 'Competent',     // 0.65 <= P(L) < 0.85
  PROFICIENT: 'Proficient',   // 0.85 <= P(L) < 0.95
  MASTER: 'Master'            // P(L) >= 0.95
};

/**
 * Updates mastery probability P(L_t) after observing a performance outcome using Bayes' rule.
 *
 * Posterior on correct:
 * P(L | correct) = (P(L) * (1 - S)) / (P(L) * (1 - S) + (1 - P(L)) * G)
 *
 * Posterior on incorrect:
 * P(L | incorrect) = (P(L) * S) / (P(L) * S + (1 - P(L)) * (1 - G))
 *
 * Transit for next trial:
 * P(L_{t+1}) = P(L | obs) + (1 - P(L | obs)) * T
 *
 * @param {number} currentMastery - Current P(L_{t-1}) in range [0, 1]
 * @param {boolean|number} isCorrect - 1/true if correct, 0/false if incorrect
 * @param {Object} [params] - Custom BKT parameters
 * @param {number} [params.pT] - Learning transition rate
 * @param {number} [params.pG] - Guess probability
 * @param {number} [params.pS] - Slip probability
 * @returns {{ posterior: number, predictedNext: number, masteryLevel: string }}
 */
export function updateMasteryBKT(currentMastery, isCorrect, params = {}) {
  const pL = Math.max(0.001, Math.min(0.999, currentMastery ?? BKT_DEFAULT_PARAMS.pL0));
  const pT = params.pT ?? BKT_DEFAULT_PARAMS.pT;
  const pG = params.pG ?? BKT_DEFAULT_PARAMS.pG;
  const pS = params.pS ?? BKT_DEFAULT_PARAMS.pS;

  const correct = Boolean(typeof isCorrect === 'number' ? isCorrect >= 0.5 : isCorrect);

  let posterior;
  if (correct) {
    const numerator = pL * (1 - pS);
    const denominator = numerator + (1 - pL) * pG;
    posterior = denominator > 0 ? numerator / denominator : pL;
  } else {
    const numerator = pL * pS;
    const denominator = numerator + (1 - pL) * (1 - pG);
    posterior = denominator > 0 ? numerator / denominator : pL;
  }

  // Next-step prediction incorporating learning transit
  const predictedNext = posterior + (1 - posterior) * pT;

  const clampedNext = Math.max(0.01, Math.min(0.99, predictedNext));

  return {
    posterior: Number(posterior.toFixed(4)),
    predictedNext: Number(clampedNext.toFixed(4)),
    masteryLevel: classifyMasteryLevel(clampedNext)
  };
}

/**
 * Classifies continuous mastery probability into human-friendly proficiency tiers.
 *
 * @param {number} probability - Mastery probability [0, 1]
 * @returns {string} One of MASTERY_LEVELS
 */
export function classifyMasteryLevel(probability) {
  if (probability >= 0.95) return MASTERY_LEVELS.MASTER;
  if (probability >= 0.85) return MASTERY_LEVELS.PROFICIENT;
  if (probability >= 0.65) return MASTERY_LEVELS.COMPETENT;
  if (probability >= 0.40) return MASTERY_LEVELS.DEVELOPING;
  return MASTERY_LEVELS.NOVICE;
}

/**
 * Applies Ebbinghaus forgetting decay to mastery based on elapsed time without practice.
 *
 * Formula: M(t) = M_floor + (M_0 - M_floor) * exp(-daysElapsed / stability)
 *
 * @param {number} currentMastery - Initial mastery probability
 * @param {number} daysElapsed - Days since last practice or assessment
 * @param {number} [stability=30] - Memory stability factor (higher = slower decay)
 * @param {number} [floor=0.15] - Base retention floor
 * @returns {number} Decayed mastery probability
 */
export function calculateMemoryDecay(currentMastery, daysElapsed, stability = 30, floor = 0.15) {
  if (daysElapsed <= 0) return currentMastery;
  if (currentMastery <= floor) return currentMastery;

  const decay = Math.exp(-daysElapsed / stability);
  const decayedMastery = floor + (currentMastery - floor) * decay;

  return Number(Math.max(floor, Math.min(1.0, decayedMastery)).toFixed(4));
}

/**
 * Propagates mastery update through a skill graph to prerequisite and parent skills.
 *
 * @param {string} targetSkillId - The skill assessed
 * @param {number} newMastery - The updated mastery of target skill
 * @param {Array<{ id: string, prerequisites: string[], parentSkillId?: string }>} skillGraph
 * @param {Map<string, number>|Object} currentMasteryMap - Current mastery scores per skill
 * @param {number} [propagationDamping=0.3] - Dampening factor for neighbor updates
 * @returns {Record<string, number>} Updated map of skill mastery scores
 */
export function propagateSkillMastery(
  targetSkillId,
  newMastery,
  skillGraph,
  currentMasteryMap = {},
  propagationDamping = 0.3
) {
  const result = { ...(currentMasteryMap instanceof Map ? Object.fromEntries(currentMasteryMap) : currentMasteryMap) };
  result[targetSkillId] = newMastery;

  const targetSkill = skillGraph.find((s) => s.id === targetSkillId);
  if (!targetSkill) return result;

  // If candidate mastered target, slightly boost prerequisites (confidence reinforcement)
  if (targetSkill.prerequisites && targetSkill.prerequisites.length > 0) {
    for (const prereqId of targetSkill.prerequisites) {
      const currentPrereq = result[prereqId] ?? BKT_DEFAULT_PARAMS.pL0;
      if (newMastery > currentPrereq) {
        const delta = (newMastery - currentPrereq) * propagationDamping;
        result[prereqId] = Number(Math.min(0.99, currentPrereq + delta).toFixed(4));
      }
    }
  }

  // If candidate belongs to a parent skill/category, update parent weighted average
  if (targetSkill.parentSkillId) {
    const parentId = targetSkill.parentSkillId;
    const siblingSkills = skillGraph.filter((s) => s.parentSkillId === parentId);
    if (siblingSkills.length > 0) {
      const siblingMasteries = siblingSkills.map((s) => result[s.id] ?? BKT_DEFAULT_PARAMS.pL0);
      const avg = siblingMasteries.reduce((a, b) => a + b, 0) / siblingMasteries.length;
      result[parentId] = Number(avg.toFixed(4));
    }
  }

  return result;
}

/**
 * Calculates Skill Gap between candidate's current masteries and target job requirements.
 *
 * @param {Record<string, number>} candidateSkills - Map of skillId to candidate mastery [0, 1]
 * @param {Record<string, number>} requiredSkills - Map of skillId to required proficiency [0, 1]
 * @returns {{ gaps: Array<{ skillId: string, current: number, required: number, gap: number, priority: string }>, matchPercentage: number }}
 */
export function calculateSkillGaps(candidateSkills, requiredSkills) {
  const gaps = [];
  let totalRequiredWeight = 0;
  let totalMatchWeight = 0;

  for (const [skillId, requiredLevel] of Object.entries(requiredSkills)) {
    const current = candidateSkills[skillId] ?? 0;
    const gap = Math.max(0, requiredLevel - current);

    let priority = 'Low';
    if (gap >= 0.4) priority = 'Critical';
    else if (gap >= 0.2) priority = 'Medium';

    gaps.push({
      skillId,
      current: Number(current.toFixed(2)),
      required: Number(requiredLevel.toFixed(2)),
      gap: Number(gap.toFixed(2)),
      priority
    });

    totalRequiredWeight += requiredLevel;
    totalMatchWeight += Math.min(current, requiredLevel);
  }

  const matchPercentage = totalRequiredWeight > 0
    ? Number(((totalMatchWeight / totalRequiredWeight) * 100).toFixed(1))
    : 100;

  // Sort gaps by priority / gap size descending
  gaps.sort((a, b) => b.gap - a.gap);

  return {
    gaps,
    matchPercentage
  };
}

/**
 * Calculates difficulty- and recency-weighted skill mastery across a series of question attempts.
 *
 * Weight formulas:
 * w_diff = Math.max(0.2, 1.0 + 0.25 * difficulty)  (harder items weighted higher)
 * w_recency = Math.exp(-0.023 * daysAgo)            (exponential half-life decay ~30 days)
 *
 * @param {Array<{ score: number, difficulty?: number, daysAgo?: number }>} attempts - History of attempts
 * @param {Object} [options]
 * @param {number} [options.decayRate=0.023]
 * @param {number} [options.priorMastery=0.20]
 * @returns {{ mastery: number, level: string, attemptCount: number, effectiveConfidence: number }}
 */
export function calculateWeightedSkillMastery(attempts = [], options = {}) {
  if (!attempts || attempts.length === 0) {
    const prior = options.priorMastery ?? BKT_DEFAULT_PARAMS.pL0;
    return {
      mastery: Number(prior.toFixed(2)),
      level: classifyMasteryLevel(prior),
      attemptCount: 0,
      effectiveConfidence: 0.1
    };
  }

  const decayRate = options.decayRate ?? 0.023; // ln(2) / 30 ~ 0.0231
  let weightedScoreSum = 0;
  let totalWeight = 0;

  for (const att of attempts) {
    const rawScore = typeof att.score === 'number' ? Math.max(0, Math.min(1, att.score)) : att ? 1 : 0;
    const diff = typeof att.difficulty === 'number' ? att.difficulty : 0.0;
    const days = typeof att.daysAgo === 'number' ? Math.max(0, att.daysAgo) : 0;

    const wDiff = Math.max(0.2, 1.0 + 0.25 * diff);
    const wRecency = Math.exp(-decayRate * days);
    const weight = wDiff * wRecency;

    weightedScoreSum += rawScore * weight;
    totalWeight += weight;
  }

  const calculatedMastery = totalWeight > 0 ? weightedScoreSum / totalWeight : 0.2;
  const clampedMastery = Math.max(0.01, Math.min(0.99, calculatedMastery));
  const effectiveConfidence = Math.min(1.0, 0.2 + attempts.length * 0.15);

  return {
    mastery: Number(clampedMastery.toFixed(2)),
    level: classifyMasteryLevel(clampedMastery),
    attemptCount: attempts.length,
    effectiveConfidence: Number(effectiveConfidence.toFixed(2))
  };
}

/**
 * Walks prerequisite hierarchy backward to detect root-cause knowledge gaps.
 *
 * @param {string} targetSkillId - Skill showing deficiency
 * @param {Record<string, string[]>} prerequisiteMap - Map of skillId to array of prerequisite skillIds
 * @param {Record<string, number>} candidateMasteryMap - Map of skillId to mastery score [0, 1]
 * @param {number} [gapThreshold=0.5] - Mastery threshold below which a prerequisite is flagged
 * @returns {{ targetSkillId: string, rootCauseGaps: Array<{ skillId: string, mastery: number, depth: number }>, isDirectFailure: boolean }}
 */
export function walkPrerequisitesRootCause(
  targetSkillId,
  prerequisiteMap = {},
  candidateMasteryMap = {},
  gapThreshold = 0.5
) {
  const rootCauses = [];
  const visited = new Set();
  const queue = [{ skillId: targetSkillId, depth: 0 }];

  while (queue.length > 0) {
    const { skillId, depth } = queue.shift();
    if (visited.has(skillId)) continue;
    visited.add(skillId);

    const prereqs = prerequisiteMap[skillId] || [];
    for (const prereq of prereqs) {
      const mastery = candidateMasteryMap[prereq] ?? 0;
      if (mastery < gapThreshold) {
        rootCauses.push({
          skillId: prereq,
          mastery: Number(mastery.toFixed(2)),
          depth: depth + 1
        });
        queue.push({ skillId: prereq, depth: depth + 1 });
      }
    }
  }

  // Deduplicate keeping deepest depth
  const mapBySkill = new Map();
  for (const item of rootCauses) {
    const existing = mapBySkill.get(item.skillId);
    if (!existing || existing.depth < item.depth) {
      mapBySkill.set(item.skillId, item);
    }
  }

  const uniqueGaps = Array.from(mapBySkill.values()).sort((a, b) => b.depth - a.depth);

  return {
    targetSkillId,
    targetMastery: candidateMasteryMap[targetSkillId] ?? 0,
    rootCauseGaps: uniqueGaps,
    isDirectFailure: uniqueGaps.length === 0
  };
}
