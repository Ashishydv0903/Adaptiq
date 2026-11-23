import {
  calculateShapleyAttributions,
  calculateLinearShapValues,
  generateCounterfactualRecommendations,
  DEFAULT_BASELINE_RUBRIC
} from '../../ml/shap.js';

describe('Shapley Value (SHAP) Attribution & Counterfactuals', () => {
  describe('calculateShapleyAttributions', () => {
    test('Satisfies the Efficiency Axiom: sum of Shapley attributions equals total score difference', () => {
      const candidateRubric = {
        technicalAccuracy: 8.5,
        conceptualDepth: 7.0,
        communication: 9.0,
        codeEfficiency: 6.0,
        problemSolving: 8.0
      };

      const result = calculateShapleyAttributions(candidateRubric, DEFAULT_BASELINE_RUBRIC);

      expect(result.efficiencyCheck.isBalanced).toBe(true);
      expect(result.candidateScore).toBeGreaterThan(result.baselineScore);
      expect(result.attributions.technicalAccuracy).toBeGreaterThan(0);
      expect(result.attributions.communication).toBeGreaterThan(0);
    });

    test('Attributions for rubric identical to baseline are zero', () => {
      const result = calculateShapleyAttributions(DEFAULT_BASELINE_RUBRIC, DEFAULT_BASELINE_RUBRIC);

      for (const val of Object.values(result.attributions)) {
        expect(Math.abs(val)).toBeLessThanOrEqual(0.01);
      }
      expect(result.totalDifference).toBe(0);
    });

    test('Waterfall progression matches running sum correctly', () => {
      const candidateRubric = {
        technicalAccuracy: 9.0,
        conceptualDepth: 8.0,
        communication: 4.0 // lower than baseline
      };

      const result = calculateShapleyAttributions(candidateRubric);
      const lastWaterfallStep = result.waterfall[result.waterfall.length - 1];

      expect(lastWaterfallStep.runningScore).toBeCloseTo(result.candidateScore, 1);
      expect(result.attributions.communication).toBeLessThan(0); // negative contribution
    });
  });

  describe('calculateLinearShapValues - Exact Linear Attributions', () => {
    const weights = {
      correctness: 2.5,
      depth: 1.8,
      clarity: 1.2,
      completeness: 1.8,
      relevance: 1.2,
      conceptCoverage: 0.8,
      semanticSimilarity: 0.7
    };

    const baseline = {
      correctness: 5.0,
      depth: 5.0,
      clarity: 5.0,
      completeness: 5.0,
      relevance: 5.0,
      conceptCoverage: 5.0,
      semanticSimilarity: 5.0
    };

    test('Efficiency Axiom: sum of linear SHAP values EXACTLY equals predicted - baseline score', () => {
      const features = {
        correctness: 8.5,
        depth: 7.0,
        clarity: 9.0,
        completeness: 6.0,
        relevance: 8.0,
        conceptCoverage: 8.0,
        semanticSimilarity: 7.5
      };

      const result = calculateLinearShapValues({
        features,
        weights,
        intercept: 0,
        baseline
      });

      expect(result.efficiencyCheck.isBalanced).toBe(true);
      expect(result.efficiencyCheck.sumOfShapley).toBeCloseTo(result.totalDifference, 1);
      expect(result.predictedScore).toBeGreaterThan(result.baselineScore);
    });

    test('Linear SHAP values are zero when features equal baseline exactly', () => {
      const result = calculateLinearShapValues({
        features: baseline,
        weights,
        intercept: 0,
        baseline
      });

      expect(result.totalDifference).toBe(0);
      for (const val of Object.values(result.attributions)) {
        expect(val).toBe(0);
      }
    });

    test('Monotonicity: features below baseline receive negative attribution', () => {
      const features = {
        ...baseline,
        depth: 2.0 // 3.0 below baseline
      };

      const result = calculateLinearShapValues({
        features,
        weights,
        intercept: 0,
        baseline
      });

      expect(result.attributions.depth).toBeLessThan(0);
      expect(result.attributions.depth).toBeCloseTo(weights.depth * (2.0 - 5.0), 2);
    });

    test('Waterfall progression starts at baseline and finishes at predicted score', () => {
      const features = {
        correctness: 9.0,
        depth: 8.0,
        clarity: 7.0,
        completeness: 4.0,
        relevance: 9.0,
        conceptCoverage: 6.0,
        semanticSimilarity: 7.0
      };

      const result = calculateLinearShapValues({
        features,
        weights,
        intercept: 0,
        baseline
      });

      expect(result.waterfall[0].step).toBe('Baseline Benchmark');
      expect(result.waterfall[0].runningScore).toBe(result.baselineScore);

      const finalWaterfallStep = result.waterfall[result.waterfall.length - 1];
      expect(finalWaterfallStep.runningScore).toBeCloseTo(result.predictedScore, 1);
    });
  });

  describe('generateCounterfactualRecommendations', () => {
    test('Generates actionable counterfactual recommendations sorted by gain', () => {
      const rubric = {
        technicalAccuracy: 6.0,
        conceptualDepth: 5.0,
        communication: 7.0,
        codeEfficiency: 5.0,
        problemSolving: 6.0
      };

      const recs = generateCounterfactualRecommendations(rubric, {
        targetDelta: 2.0,
        targetGoalScore: 75.0
      });

      expect(recs.length).toBeGreaterThan(0);
      expect(recs[0].potentialGain).toBeGreaterThan(0);
      expect(recs[0].recommendation).toBeDefined();
      // Sorted descending by gain
      for (let i = 1; i < recs.length; i++) {
        expect(recs[i - 1].potentialGain).toBeGreaterThanOrEqual(recs[i].potentialGain);
      }
    });
  });
});
