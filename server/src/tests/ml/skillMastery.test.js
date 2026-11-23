import {
  updateMasteryBKT,
  classifyMasteryLevel,
  calculateMemoryDecay,
  propagateSkillMastery,
  calculateSkillGaps,
  calculateWeightedSkillMastery,
  walkPrerequisitesRootCause,
  MASTERY_LEVELS
} from '../../ml/skillMastery.js';

describe('Skill Mastery Engine (BKT & Forgetting Curves)', () => {
  describe('updateMasteryBKT', () => {
    test('Correct answer increases mastery probability', () => {
      const initial = 0.3;
      const updated = updateMasteryBKT(initial, true);
      expect(updated.posterior).toBeGreaterThan(initial);
      expect(updated.predictedNext).toBeGreaterThan(updated.posterior);
    });

    test('Incorrect answer decreases mastery probability', () => {
      const initial = 0.7;
      const updated = updateMasteryBKT(initial, false);
      expect(updated.posterior).toBeLessThan(initial);
    });

    test('Sequence of correct responses approaches high mastery', () => {
      let mastery = 0.2;
      for (let i = 0; i < 6; i++) {
        mastery = updateMasteryBKT(mastery, true).predictedNext;
      }
      expect(mastery).toBeGreaterThan(0.85);
      expect(classifyMasteryLevel(mastery)).toMatch(/Proficient|Master/);
    });
  });

  describe('classifyMasteryLevel', () => {
    test('Classifies mastery into appropriate tiers', () => {
      expect(classifyMasteryLevel(0.20)).toBe(MASTERY_LEVELS.NOVICE);
      expect(classifyMasteryLevel(0.50)).toBe(MASTERY_LEVELS.DEVELOPING);
      expect(classifyMasteryLevel(0.75)).toBe(MASTERY_LEVELS.COMPETENT);
      expect(classifyMasteryLevel(0.90)).toBe(MASTERY_LEVELS.PROFICIENT);
      expect(classifyMasteryLevel(0.98)).toBe(MASTERY_LEVELS.MASTER);
    });
  });

  describe('calculateMemoryDecay', () => {
    test('Decays mastery over elapsed days without dropping below floor', () => {
      const initial = 0.90;
      const day30 = calculateMemoryDecay(initial, 30, 30, 0.15);
      const day90 = calculateMemoryDecay(initial, 90, 30, 0.15);

      expect(day30).toBeLessThan(initial);
      expect(day90).toBeLessThan(day30);
      expect(day90).toBeGreaterThanOrEqual(0.15);
    });

    test('Returns original mastery if days elapsed <= 0', () => {
      expect(calculateMemoryDecay(0.8, 0)).toBe(0.8);
      expect(calculateMemoryDecay(0.8, -5)).toBe(0.8);
    });
  });

  describe('propagateSkillMastery', () => {
    const mockGraph = [
      { id: 'react', prerequisites: ['javascript', 'html-css'], parentSkillId: 'frontend' },
      { id: 'javascript', prerequisites: [], parentSkillId: 'frontend' },
      { id: 'html-css', prerequisites: [], parentSkillId: 'frontend' }
    ];

    test('Propagates mastery gain to prerequisite skills with damping', () => {
      const current = { react: 0.3, javascript: 0.4, 'html-css': 0.5 };
      const updated = propagateSkillMastery('react', 0.9, mockGraph, current, 0.3);

      expect(updated.react).toBe(0.9);
      expect(updated.javascript).toBeGreaterThan(0.4);
      expect(updated.frontend).toBeDefined();
    });
  });

  describe('calculateSkillGaps', () => {
    test('Identifies critical gaps and overall match percentage correctly', () => {
      const candidate = {
        nodejs: 0.8,
        react: 0.7,
        docker: 0.2
      };
      const required = {
        nodejs: 0.8,
        react: 0.8,
        docker: 0.8,
        kubernetes: 0.6
      };

      const result = calculateSkillGaps(candidate, required);
      expect(result.matchPercentage).toBeLessThan(100);
      expect(result.gaps.length).toBe(4);

      const dockerGap = result.gaps.find((g) => g.skillId === 'docker');
      expect(dockerGap.priority).toBe('Critical');
      expect(dockerGap.gap).toBeCloseTo(0.6, 2);
    });
  });

  describe('calculateWeightedSkillMastery', () => {
    test('Calculates difficulty- and recency-weighted mastery correctly', () => {
      // Recent hard question correct vs old easy question incorrect
      const attempts = [
        { score: 1.0, difficulty: 2.0, daysAgo: 1 },  // high diff, recent -> high weight
        { score: 0.0, difficulty: -1.0, daysAgo: 60 } // low diff, old -> low weight
      ];

      const res = calculateWeightedSkillMastery(attempts);
      expect(res.mastery).toBeGreaterThan(0.70);
      expect(res.attemptCount).toBe(2);
      expect(res.effectiveConfidence).toBeGreaterThan(0.4);
    });

    test('Returns default prior mastery when no attempts exist', () => {
      const res = calculateWeightedSkillMastery([]);
      expect(res.mastery).toBe(0.20);
      expect(res.level).toBe(MASTERY_LEVELS.NOVICE);
      expect(res.attemptCount).toBe(0);
    });
  });

  describe('walkPrerequisitesRootCause', () => {
    const prereqMap = {
      'distributed-transactions': ['acid-transactions', 'event-driven-architecture'],
      'acid-transactions': ['sql-joins-indexing'],
      'sql-joins-indexing': ['relational-db-modeling'],
      'relational-db-modeling': []
    };

    test('Identifies deepest deficient prerequisite as root cause', () => {
      const candidateMasteries = {
        'distributed-transactions': 0.20,
        'acid-transactions': 0.30,
        'sql-joins-indexing': 0.25,
        'relational-db-modeling': 0.85
      };

      const result = walkPrerequisitesRootCause('distributed-transactions', prereqMap, candidateMasteries);
      expect(result.isDirectFailure).toBe(false);
      expect(result.rootCauseGaps.length).toBeGreaterThan(0);
      // sql-joins-indexing is the deepest failed prereq (depth 2)
      const deepest = result.rootCauseGaps[0];
      expect(deepest.skillId).toBe('sql-joins-indexing');
      expect(deepest.depth).toBe(2);
    });

    test('Reports direct failure when all prerequisites are satisfied', () => {
      const candidateMasteries = {
        'distributed-transactions': 0.20,
        'acid-transactions': 0.85,
        'sql-joins-indexing': 0.90,
        'event-driven-architecture': 0.80
      };

      const result = walkPrerequisitesRootCause('distributed-transactions', prereqMap, candidateMasteries);
      expect(result.isDirectFailure).toBe(true);
      expect(result.rootCauseGaps.length).toBe(0);
    });
  });
});
