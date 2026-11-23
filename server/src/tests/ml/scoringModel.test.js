import {
  calculateCosineSimilarity,
  calculateIntegrityMultiplier,
  computeCompositeScore,
  extractScoringFeatures,
  predictRidgeScore,
  fitRidgeRegression,
  DEFAULT_RIDGE_WEIGHTS
} from '../../ml/scoringModel.js';

describe('Scoring Model & Integrity Engine', () => {
  describe('calculateCosineSimilarity', () => {
    test('Calculates identical vectors as similarity 1.0', () => {
      const v = [0.2, 0.4, 0.8];
      const sim = calculateCosineSimilarity(v, v);
      expect(sim).toBeCloseTo(1.0, 2);
    });

    test('Calculates orthogonal vectors as normalized similarity 0.5', () => {
      const v1 = [1, 0, 0];
      const v2 = [0, 1, 0];
      const sim = calculateCosineSimilarity(v1, v2);
      expect(sim).toBeCloseTo(0.5, 2);
    });

    test('Handles empty or invalid vectors gracefully', () => {
      expect(calculateCosineSimilarity([], [1, 2])).toBe(0);
      expect(calculateCosineSimilarity(null, [1, 2])).toBe(0);
    });
  });

  describe('calculateIntegrityMultiplier', () => {
    test('Grants 1.0 multiplier for normal test taking behavior', () => {
      const res = calculateIntegrityMultiplier({
        tabSwitches: 1,
        durationSeconds: 45,
        wordCount: 80,
        pasteDetected: false
      });
      expect(res.multiplier).toBe(1.0);
      expect(res.penalties.length).toBe(0);
    });

    test('Applies penalty for excessive window switches', () => {
      const res = calculateIntegrityMultiplier({
        tabSwitches: 5,
        durationSeconds: 45,
        wordCount: 80
      });
      expect(res.multiplier).toBeLessThan(1.0);
      expect(res.penalties.length).toBeGreaterThan(0);
      expect(res.penalties[0].reason).toMatch(/Excessive window switches/);
    });

    test('Applies penalty for copy-paste velocity anomaly', () => {
      const res = calculateIntegrityMultiplier({
        tabSwitches: 0,
        durationSeconds: 2,
        wordCount: 120,
        pasteDetected: true
      });
      expect(res.multiplier).toBeLessThan(1.0);
      expect(res.penalties.some((p) => p.reason.includes('unusually fast'))).toBe(true);
    });
  });

  describe('computeCompositeScore', () => {
    test('Computes weighted score with dimensions and confidence intervals', () => {
      const rubric = {
        technicalAccuracy: 8.0,
        conceptualDepth: 7.0,
        communication: 9.0,
        codeEfficiency: 8.0,
        problemSolving: 7.5
      };

      const result = computeCompositeScore(rubric);
      expect(result.finalScore).toBeGreaterThan(70);
      expect(result.finalScore).toBeLessThan(90);
      expect(result.confidenceInterval.lower).toBeLessThanOrEqual(result.finalScore);
      expect(result.confidenceInterval.upper).toBeGreaterThanOrEqual(result.finalScore);
      expect(result.dimensions.technicalAccuracy.score).toBe(8.0);
    });

    test('Incorporates semantic similarity when provided', () => {
      const rubric = {
        technicalAccuracy: 6.0,
        conceptualDepth: 6.0,
        communication: 6.0,
        codeEfficiency: 6.0,
        problemSolving: 6.0
      };

      const withoutSim = computeCompositeScore(rubric);
      const withHighSim = computeCompositeScore(rubric, { semanticSimilarity: 1.0 });

      expect(withHighSim.finalScore).toBeGreaterThan(withoutSim.finalScore);
    });
  });

  describe('extractScoringFeatures & Ridge Regression', () => {
    test('extractScoringFeatures normalizes all features to [0, 10] range', () => {
      const features = extractScoringFeatures({
        rubricScores: {
          correctness: 9.5,
          depth: 8.0,
          clarity: 7.5,
          completeness: 8.5,
          relevance: 9.0
        },
        conceptCoverageRatio: 0.85,
        semanticSimilarity: 0.92
      });

      expect(features.correctness).toBe(9.5);
      expect(features.conceptCoverage).toBe(8.5); // 0.85 * 10
      expect(features.semanticSimilarity).toBe(9.2); // 0.92 * 10
      for (const val of Object.values(features)) {
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(10);
      }
    });

    test('predictRidgeScore maps calibrated [0, 10] features accurately to [0, 100]', () => {
      const maxFeatures = {
        correctness: 10,
        depth: 10,
        clarity: 10,
        completeness: 10,
        relevance: 10,
        conceptCoverage: 10,
        semanticSimilarity: 10
      };

      const maxScore = predictRidgeScore(maxFeatures, DEFAULT_RIDGE_WEIGHTS, 0);
      expect(maxScore).toBe(100);

      const zeroFeatures = {
        correctness: 0,
        depth: 0,
        clarity: 0,
        completeness: 0,
        relevance: 0,
        conceptCoverage: 0,
        semanticSimilarity: 0
      };

      const zeroScore = predictRidgeScore(zeroFeatures, DEFAULT_RIDGE_WEIGHTS, 0);
      expect(zeroScore).toBe(0);

      const midFeatures = {
        correctness: 5,
        depth: 5,
        clarity: 5,
        completeness: 5,
        relevance: 5,
        conceptCoverage: 5,
        semanticSimilarity: 5
      };

      const midScore = predictRidgeScore(midFeatures, DEFAULT_RIDGE_WEIGHTS, 0);
      expect(midScore).toBe(50);
    });

    test('fitRidgeRegression learns stable coefficients with L2 regularization', () => {
      // 5 training samples across 3 features
      const X = [
        [8, 7, 9],
        [4, 5, 3],
        [9, 9, 8],
        [6, 5, 7],
        [2, 3, 2]
      ];
      // Target scores roughly matching weighted sum
      const y = [80, 42, 90, 60, 25];

      const model = fitRidgeRegression(X, y, { lambda: 0.5, fitIntercept: true });

      expect(model.weights.length).toBe(3);
      for (const w of model.weights) {
        expect(typeof w).toBe('number');
        expect(isNaN(w)).toBe(false);
        expect(w).toBeGreaterThan(0); // Positive association with performance
      }
    });
  });
});
