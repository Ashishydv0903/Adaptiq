import {
  calculateProbability,
  calculateItemInformation,
  calculateTestInformation,
  calculateSEM,
  estimateAbilityMLE,
  estimateAbilityEAP,
  selectNextQuestion,
  shouldStopAdaptiveTest,
  thetaToPercentileScore,
  IRT_DEFAULTS
} from '../../ml/irt.js';

describe('Item Response Theory (IRT) Engine', () => {
  describe('calculateProbability', () => {
    test('1PL / Rasch model: probability is 0.5 when theta equals b', () => {
      const p = calculateProbability(0.0, 0.0, 1.0, 0.0);
      expect(p).toBeCloseTo(0.5, 4);
    });

    test('Higher ability candidate has higher probability of answering correctly', () => {
      const pLow = calculateProbability(-1.0, 0.0, 1.0, 0.0);
      const pMid = calculateProbability(0.0, 0.0, 1.0, 0.0);
      const pHigh = calculateProbability(1.0, 0.0, 1.0, 0.0);

      expect(pLow).toBeLessThan(pMid);
      expect(pMid).toBeLessThan(pHigh);
      expect(pHigh).toBeGreaterThan(0.7);
    });

    test('3PL model respects pseudo-guessing lower bound c', () => {
      const c = 0.25;
      const pExtremeLow = calculateProbability(-10.0, 2.0, 1.5, c);
      expect(pExtremeLow).toBeGreaterThanOrEqual(c);
      expect(pExtremeLow).toBeCloseTo(c, 2);
    });

    test('Clamps extreme exponent values without throwing or NaN', () => {
      expect(calculateProbability(100.0, 0.0)).toBeCloseTo(1.0, 4);
      expect(calculateProbability(-100.0, 0.0)).toBeCloseTo(0.0, 4);
    });
  });

  describe('calculateItemInformation', () => {
    test('Information is maximized near item difficulty b when c=0', () => {
      const b = 0.5;
      const a = 1.5;
      const infoAtB = calculateItemInformation(b, b, a, 0);
      const infoBelow = calculateItemInformation(b - 1.5, b, a, 0);
      const infoAbove = calculateItemInformation(b + 1.5, b, a, 0);

      expect(infoAtB).toBeGreaterThan(infoBelow);
      expect(infoAtB).toBeGreaterThan(infoAbove);
    });

    test('Higher discrimination a yields higher Fisher Information', () => {
      const theta = 0.0;
      const b = 0.0;
      const infoA1 = calculateItemInformation(theta, b, 1.0);
      const infoA2 = calculateItemInformation(theta, b, 2.0);

      expect(infoA2).toBeGreaterThan(infoA1);
    });

    test('Information with guessing parameter c > 0', () => {
      const info = calculateItemInformation(0.5, 0.5, 1.2, 0.2);
      expect(info).toBeGreaterThan(0);
      expect(Number.isFinite(info)).toBe(true);
    });
  });

  describe('calculateTestInformation and SEM', () => {
    test('Test information accumulates sum of individual item information', () => {
      const items = [
        { b: -1.0, a: 1.0 },
        { b: 0.0, a: 1.2 },
        { b: 1.0, a: 1.0 }
      ];
      const tif = calculateTestInformation(0.0, items);
      expect(tif).toBeGreaterThan(0.5);

      const sem = calculateSEM(0.0, items);
      expect(sem).toBeCloseTo(1 / Math.sqrt(tif), 4);
    });

    test('Returns initial SEM when item pool is empty', () => {
      const sem = calculateSEM(0.0, []);
      expect(sem).toBe(1.0);
    });
  });

  describe('estimateAbilityEAP - Mathematical Trajectory Proofs', () => {
    test('PROVES: Theta rises after correct answers', () => {
      const item = { b: 0.0, a: 1.2, c: 0.0 };
      const before = estimateAbilityEAP([]);
      expect(before.theta).toBe(0.0);

      const afterCorrect1 = estimateAbilityEAP([{ ...item, score: 1 }]);
      expect(afterCorrect1.theta).toBeGreaterThan(before.theta);

      const afterCorrect2 = estimateAbilityEAP([
        { ...item, score: 1 },
        { b: 0.5, a: 1.2, c: 0.0, score: 1 }
      ]);
      expect(afterCorrect2.theta).toBeGreaterThan(afterCorrect1.theta);
    });

    test('PROVES: Theta falls after wrong answers', () => {
      const item = { b: 0.0, a: 1.2, c: 0.0 };
      const before = estimateAbilityEAP([]);

      const afterIncorrect1 = estimateAbilityEAP([{ ...item, score: 0 }]);
      expect(afterIncorrect1.theta).toBeLessThan(before.theta);

      const afterIncorrect2 = estimateAbilityEAP([
        { ...item, score: 0 },
        { b: -0.5, a: 1.2, c: 0.0, score: 0 }
      ]);
      expect(afterIncorrect2.theta).toBeLessThan(afterIncorrect1.theta);
    });

    test('SEM monotonically decreases as more items are administered', () => {
      const responses = [];
      let lastSEM = 1.0;

      for (let i = 0; i < 12; i++) {
        responses.push({ b: 0.0, a: 1.5, c: 0.0, score: i % 2 === 0 ? 1 : 0 });
        const { sem } = estimateAbilityEAP(responses);
        expect(sem).toBeLessThanOrEqual(lastSEM);
        lastSEM = sem;
      }
      expect(lastSEM).toBeLessThan(0.38);
    });
  });

  describe('selectNextQuestion - Adaptive Progression & Topic Balance', () => {
    const questionBank = [
      { id: 'easy_react', b: -1.5, a: 1.2, topic: 'react' },
      { id: 'mid_react', b: 0.0, a: 1.4, topic: 'react' },
      { id: 'hard_react', b: 1.8, a: 1.5, topic: 'react' },
      { id: 'easy_node', b: -1.2, a: 1.1, topic: 'node' },
      { id: 'mid_node', b: 0.2, a: 1.3, topic: 'node' },
      { id: 'hard_node', b: 2.0, a: 1.4, topic: 'node' },
      { id: 'mid_db', b: 0.1, a: 1.3, topic: 'database' },
      { id: 'hard_db', b: 1.7, a: 1.5, topic: 'database' }
    ];

    test('PROVES: Harder questions are selected as ability increases', () => {
      // For low ability (-1.5), selected item should have lower difficulty
      const lowAbilityItem = selectNextQuestion(-1.5, questionBank, [], { topK: 1, bWindow: 1.0 });
      expect(lowAbilityItem.b).toBeLessThanOrEqual(-1.0);

      // For high ability (+1.8), selected item should have higher difficulty
      const highAbilityItem = selectNextQuestion(1.8, questionBank, [], { topK: 1, bWindow: 1.0 });
      expect(highAbilityItem.b).toBeGreaterThanOrEqual(1.5);
    });

    test('PROVES: Topic-balance constraint avoids repeating same topic continuously', () => {
      // Simulate candidate having already received 2 react questions
      const administered = [
        { id: 'easy_react', topic: 'react' },
        { id: 'mid_react', topic: 'react' }
      ];

      // At theta=0.0, both mid_react and mid_node/mid_db are in window
      // Topic balance penalty should prioritize node or database over react
      const selected = selectNextQuestion(0.0, questionBank, administered, {
        topK: 1,
        enforceTopicBalance: true
      });

      expect(selected.topic).not.toBe('react');
      expect(['node', 'database']).toContain(selected.topic);
    });

    test('Returns null when all eligible items in pool are exhausted', () => {
      const allIds = questionBank.map((q) => q.id);
      const selected = selectNextQuestion(0.0, questionBank, allIds);
      expect(selected).toBeNull();
    });
  });

  describe('shouldStopAdaptiveTest - Stopping Rule', () => {
    test('PROVES: Stops when target precision reached (SE < 0.30 and min questions met)', () => {
      const responses = Array.from({ length: 8 }, (_, i) => ({ score: 1 }));
      const rule = shouldStopAdaptiveTest(responses, 0.28, { targetSEM: 0.30, minQuestions: 5 });

      expect(rule.shouldStop).toBe(true);
      expect(rule.reason).toBe('TARGET_PRECISION_REACHED');
      expect(rule.questionsAsked).toBe(8);
    });

    test('PROVES: Stops when maximum test length of 20 questions is reached', () => {
      const responses = Array.from({ length: 20 }, (_, i) => ({ score: 1 }));
      const rule = shouldStopAdaptiveTest(responses, 0.35, { maxQuestions: 20 });

      expect(rule.shouldStop).toBe(true);
      expect(rule.reason).toBe('MAX_QUESTIONS_REACHED');
      expect(rule.questionsAsked).toBe(20);
    });

    test('Continues when neither SE threshold nor max questions reached', () => {
      const responses = [{ score: 1 }, { score: 0 }, { score: 1 }];
      const rule = shouldStopAdaptiveTest(responses, 0.55);

      expect(rule.shouldStop).toBe(false);
      expect(rule.reason).toBe('CONTINUE');
    });
  });

  describe('thetaToPercentileScore', () => {
    test('Converts theta 0 to roughly 50th percentile', () => {
      const score = thetaToPercentileScore(0.0);
      expect(score).toBeCloseTo(50.0, 0);
    });

    test('Monotonically increases from low to high theta', () => {
      const sLow = thetaToPercentileScore(-2.0);
      const sMid = thetaToPercentileScore(0.0);
      const sHigh = thetaToPercentileScore(2.0);

      expect(sLow).toBeLessThan(sMid);
      expect(sMid).toBeLessThan(sHigh);
      expect(sHigh).toBeGreaterThan(95.0);
    });
  });
});
