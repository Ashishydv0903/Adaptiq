/**
 * @file 3-Level Costed Hint Ladder Service
 * Handles hint availability, penalty deduction, and step-by-step hint unlocking.
 */

export const DEFAULT_HINT_PENALTIES = {
  1: 2,  // Level 1: Conceptual nudge (cost: 2 points)
  2: 5,  // Level 2: Algorithmic strategy & data structure (cost: 5 points)
  3: 10  // Level 3: Pseudocode & implementation edge case (cost: 10 points)
};

/**
 * Standard fallback hints for coding questions if not custom-specified
 */
export function getDefaultHintsForCoding(title = 'Algorithm Problem') {
  return [
    {
      level: 1,
      penaltyPoints: 2,
      hintText: 'Conceptual Nudge: Consider the trade-off between time and space complexity. Can an auxiliary data structure like a Hash Map, Set, or Two Pointers avoid nested loops?'
    },
    {
      level: 2,
      penaltyPoints: 5,
      hintText: 'Algorithmic Strategy: Iterate through the elements while keeping track of previously seen states or complements. Lookups in a hash structure are amortized O(1).'
    },
    {
      level: 3,
      penaltyPoints: 10,
      hintText: 'Pseudocode: 1. Initialize map = new Map(). 2. Loop through input array. 3. Check if required target complement exists in map; if yes, return indices. 4. Otherwise store current element and index.'
    }
  ];
}

/**
 * Returns available hint levels and unlock statuses for a candidate.
 * Redacts hintText for locked hints to prevent client-side inspection.
 *
 * @param {Object} question - Question document
 * @param {Array<Object>} [unlockedHints=[]] - Array of unlocked hints in session
 * @returns {Array<Object>} Sanitized hint ladder items
 */
export function getSanitizedHintLadder(question, unlockedHints = []) {
  const hints = (question.hints && question.hints.length > 0)
    ? question.hints
    : getDefaultHintsForCoding(question.title);

  const unlockedLevels = new Set(unlockedHints.map((h) => h.level));

  return hints.map((h) => {
    const isUnlocked = unlockedLevels.has(h.level);
    return {
      level: h.level,
      penaltyPoints: h.penaltyPoints || DEFAULT_HINT_PENALTIES[h.level] || 2,
      isUnlocked,
      hintText: isUnlocked ? h.hintText : null,
      title: h.level === 1
        ? 'Level 1: Conceptual Nudge'
        : h.level === 2
          ? 'Level 2: Algorithmic Strategy'
          : 'Level 3: Pseudocode & Implementation'
    };
  });
}

/**
 * Unlocks a specific hint level, records penalty, and returns full hint text.
 *
 * @param {Object} params
 * @param {Object} params.question - Question document
 * @param {Array<Object>} params.unlockedHints - Current list of unlocked hints
 * @param {number} params.requestedLevel - Hint level to unlock (1, 2, or 3)
 * @returns {{ unlockedHint: Object, totalPenaltyPoints: number }}
 */
export function unlockHintLevel({ question, unlockedHints = [], requestedLevel }) {
  const levelNum = Number(requestedLevel);
  if (![1, 2, 3].includes(levelNum)) {
    throw new Error('Hint level must be 1, 2, or 3');
  }

  // Check if already unlocked
  const alreadyUnlocked = unlockedHints.find((h) => h.level === levelNum);
  if (alreadyUnlocked) {
    const allHints = (question.hints && question.hints.length > 0)
      ? question.hints
      : getDefaultHintsForCoding(question.title);
    const target = allHints.find((h) => h.level === levelNum) || allHints[levelNum - 1];
    return {
      unlockedHint: {
        level: levelNum,
        penaltyPoints: alreadyUnlocked.penaltyPoints,
        hintText: target.hintText,
        unlockedAt: alreadyUnlocked.unlockedAt
      },
      alreadyUnlocked: true,
      totalPenaltyPoints: unlockedHints.reduce((sum, h) => sum + (h.penaltyPoints || 0), 0)
    };
  }

  const allHints = (question.hints && question.hints.length > 0)
    ? question.hints
    : getDefaultHintsForCoding(question.title);

  const targetHint = allHints.find((h) => h.level === levelNum) || allHints[levelNum - 1];
  const penalty = targetHint.penaltyPoints || DEFAULT_HINT_PENALTIES[levelNum] || 2;

  const newUnlockRecord = {
    level: levelNum,
    penaltyPoints: penalty,
    unlockedAt: new Date()
  };

  const updatedUnlocked = [...unlockedHints, newUnlockRecord];
  const totalPenalty = updatedUnlocked.reduce((sum, h) => sum + (h.penaltyPoints || 0), 0);

  return {
    unlockedHint: {
      ...newUnlockRecord,
      hintText: targetHint.hintText
    },
    alreadyUnlocked: false,
    totalPenaltyPoints: totalPenalty,
    updatedUnlockedList: updatedUnlocked
  };
}
