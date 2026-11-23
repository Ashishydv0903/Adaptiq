import {
  calculateGroupMeanGap,
  calculateCohensD,
  calculateSelectionRateRatio,
  calculateDemographicParity,
  calculateDisparateImpact,
  FAIRNESS_THRESHOLDS
} from '../../ml/fairness.js';

describe('Fairness & Bias Auditing Metrics', () => {
  describe('calculateGroupMeanGap', () => {
    test('Calculates mean score gap between two demographic cohorts', () => {
      const groupA = [80, 85, 90, 85]; // Mean = 85
      const groupB = [75, 80, 85, 80]; // Mean = 80

      const result = calculateGroupMeanGap(groupA, groupB);

      expect(result.meanA).toBe(85);
      expect(result.meanB).toBe(80);
      expect(result.gap).toBe(5);
      expect(result.percentageGap).toBeCloseTo(5.88, 1);
      expect(result.sampleSizeA).toBe(4);
      expect(result.sampleSizeB).toBe(4);
    });

    test('Returns zero gap when both groups have identical scores', () => {
      const groupA = [70, 80, 90];
      const groupB = [70, 80, 90];

      const result = calculateGroupMeanGap(groupA, groupB);
      expect(result.gap).toBe(0);
      expect(result.percentageGap).toBe(0);
    });

    test('Handles empty groups safely without throwing', () => {
      const result = calculateGroupMeanGap([], []);
      expect(result.gap).toBe(0);
      expect(result.sampleSizeA).toBe(0);
      expect(result.sampleSizeB).toBe(0);
    });
  });

  describe('calculateCohensD - Standardized Effect Size', () => {
    test('Computes medium effect size disparity correctly', () => {
      // Group A (Privileged): higher scores with standard dev ~ 5
      const groupA = [85, 90, 88, 92, 85, 87]; // Mean ~ 87.83
      // Group B (Unprivileged): lower scores
      const groupB = [80, 82, 81, 84, 79, 83]; // Mean ~ 81.5

      const result = calculateCohensD(groupA, groupB);

      expect(result.d).toBeGreaterThan(0.5);
      expect(result.pooledStdDev).toBeGreaterThan(0);
      expect(['medium', 'large']).toContain(result.interpretation);
      expect(result.isDisparitySignificant).toBe(true);
    });

    test('Identifies negligible effect size when groups are closely matched', () => {
      const groupA = [80, 81, 82, 80, 81];
      const groupB = [80, 80, 81, 81, 82];

      const result = calculateCohensD(groupA, groupB);
      expect(Math.abs(result.d)).toBeLessThan(0.2);
      expect(result.interpretation).toBe('negligible');
      expect(result.isDisparitySignificant).toBe(false);
    });

    test('Returns insufficient_sample when fewer than 2 data points are provided', () => {
      const result = calculateCohensD([85], [80]);
      expect(result.interpretation).toBe('insufficient_sample');
      expect(result.d).toBe(0);
    });
  });

  describe('calculateSelectionRateRatio - EEOC 80% (Four-Fifths) Rule', () => {
    test('Passes 80% rule when unprivileged selection rate is >= 80% of privileged rate', () => {
      // Privileged: 8 of 10 pass (80% rate)
      const priv = [85, 90, 78, 82, 75, 88, 92, 77, 60, 55];
      // Unprivileged: 7 of 10 pass (70% rate) -> 70 / 80 = 87.5% ratio >= 80%
      const unpriv = [80, 82, 76, 75, 84, 79, 78, 65, 58, 50];

      const result = calculateSelectionRateRatio(unpriv, priv, 75);

      expect(result.selectionRatePrivileged).toBe(0.8);
      expect(result.selectionRateUnprivileged).toBe(0.7);
      expect(result.selectionRateRatio).toBeCloseTo(0.875, 2);
      expect(result.violates80Rule).toBe(false);
      expect(result.shortfall).toBe(0);
      expect(result.recommendation).toContain('Compliant');
    });

    test('Flags adverse impact violation when selection rate ratio is below 0.80 and calculates shortfall', () => {
      // Privileged: 9 of 10 pass (90% rate)
      const priv = [80, 85, 90, 75, 82, 88, 91, 78, 86, 60];
      // Unprivileged: 4 of 10 pass (40% rate) -> 40 / 90 = 44.4% ratio < 80%
      const unpriv = [80, 82, 76, 75, 60, 55, 62, 58, 65, 50];

      const result = calculateSelectionRateRatio(unpriv, priv, 75);

      expect(result.selectionRatePrivileged).toBe(0.9);
      expect(result.selectionRateUnprivileged).toBe(0.4);
      expect(result.selectionRateRatio).toBeLessThan(0.80);
      expect(result.violates80Rule).toBe(true);
      expect(result.shortfall).toBeGreaterThan(0);
      expect(result.recommendation).toContain('Adverse impact detected');
    });
  });
});