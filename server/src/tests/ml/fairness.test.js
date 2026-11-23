import {
  calculateDemographicParity,
  calculateDisparateImpact,
  calculateEqualizedOdds,
  calculatePredictiveParity,
  generateFairnessAuditReport
} from '../../ml/fairness.js';

describe('Algorithmic Fairness & Bias Auditing Engine', () => {
  describe('calculateDemographicParity & Disparate Impact', () => {
    test('Passes when selection rates between privileged and unprivileged groups are balanced', () => {
      // 80% selection rate in both groups
      const unprivileged = Array.from({ length: 50 }, (_, i) => ({ predicted: i < 40 }));
      const privileged = Array.from({ length: 50 }, (_, i) => ({ predicted: i < 41 }));

      const parity = calculateDemographicParity(unprivileged, privileged);
      const impact = calculateDisparateImpact(unprivileged, privileged);

      expect(parity.passes).toBe(true);
      expect(parity.difference).toBeLessThan(0.05);
      expect(impact.violatesEEOC).toBe(false);
      expect(impact.disparateImpactRatio).toBeGreaterThanOrEqual(0.80);
    });

    test('Detects EEOC 80% rule violation when unprivileged selection rate is significantly depressed', () => {
      // Privileged: 80% selected. Unprivileged: 40% selected -> ratio = 0.50 (< 0.80)
      const unprivileged = Array.from({ length: 50 }, (_, i) => ({ predicted: i < 20 }));
      const privileged = Array.from({ length: 50 }, (_, i) => ({ predicted: i < 40 }));

      const impact = calculateDisparateImpact(unprivileged, privileged);

      expect(impact.violatesEEOC).toBe(true);
      expect(impact.disparateImpactRatio).toBeLessThan(0.80);
      expect(impact.recommendation).toMatch(/Adverse impact detected/);
    });
  });

  describe('calculateEqualizedOdds', () => {
    test('Calculates TPR and FPR disparities across groups', () => {
      const unprivileged = [
        { actual: 1, predicted: 1 },
        { actual: 1, predicted: 0 },
        { actual: 0, predicted: 0 },
        { actual: 0, predicted: 1 }
      ];
      const privileged = [
        { actual: 1, predicted: 1 },
        { actual: 1, predicted: 1 },
        { actual: 0, predicted: 0 },
        { actual: 0, predicted: 0 }
      ];

      const odds = calculateEqualizedOdds(unprivileged, privileged);
      expect(odds.unprivilegedTPR).toBeDefined();
      expect(odds.privilegedTPR).toBeDefined();
      expect(odds.tprDiff).toBeGreaterThan(0);
    });
  });

  describe('calculatePredictiveParity', () => {
    test('Evaluates precision parity between groups', () => {
      const groupA = [{ actual: 1, predicted: 1 }, { actual: 0, predicted: 1 }];
      const groupB = [{ actual: 1, predicted: 1 }, { actual: 1, predicted: 1 }];

      const parity = calculatePredictiveParity(groupA, groupB);
      expect(parity.unprivilegedPPV).toBe(0.5);
      expect(parity.privilegedPPV).toBe(1.0);
      expect(parity.passes).toBe(false);
    });
  });

  describe('generateFairnessAuditReport', () => {
    test('Generates comprehensive audit report with compliance status', () => {
      const dataset = [
        // Majority group
        ...Array.from({ length: 40 }, () => ({
          demographicGroup: 'majority',
          actual: 1,
          predicted: 1,
          score: 85
        })),
        ...Array.from({ length: 10 }, () => ({
          demographicGroup: 'majority',
          actual: 0,
          predicted: 0,
          score: 55
        })),
        // Minority group
        ...Array.from({ length: 38 }, () => ({
          demographicGroup: 'minority',
          actual: 1,
          predicted: 1,
          score: 82
        })),
        ...Array.from({ length: 12 }, () => ({
          demographicGroup: 'minority',
          actual: 0,
          predicted: 0,
          score: 52
        }))
      ];

      const report = generateFairnessAuditReport(dataset, 'majority');
      expect(report.sampleSize.total).toBe(100);
      expect(report.isCompliant).toBe(true);
      expect(report.metrics.disparateImpact.violatesEEOC).toBe(false);
    });
  });
});
