import {
  calculateMantelHaenszelDIF,
  calculateLordsChiSquare,
  ETS_CATEGORIES
} from '../../ml/dif.js';

describe('Differential Item Functioning (DIF) Detection', () => {
  describe('calculateMantelHaenszelDIF', () => {
    test('Identifies unbiased questions as ETS Category A (Approved)', () => {
      // Create balanced responses where reference and focal groups perform identically across ability strata
      const responses = [];
      for (let ability = 20; ability <= 80; ability += 20) {
        // High ability stratum
        for (let i = 0; i < 15; i++) {
          responses.push({ isCorrect: 1, totalScore: ability, group: 'reference' });
          responses.push({ isCorrect: 1, totalScore: ability, group: 'focal' });
        }
        // Occasional incorrect
        for (let i = 0; i < 5; i++) {
          responses.push({ isCorrect: 0, totalScore: ability, group: 'reference' });
          responses.push({ isCorrect: 0, totalScore: ability, group: 'focal' });
        }
      }

      const result = calculateMantelHaenszelDIF(responses, 4);

      expect(result.category.level).toBe('A');
      expect(result.category.action).toBe('Approved');
      expect(result.isBiased).toBe(false);
      expect(Math.abs(result.deltaMH)).toBeLessThan(1.0);
    });

    test('Detects severe bias against focal group as ETS Category C (Quarantine)', () => {
      // In every matched stratum, reference group gets it right much more often than focal group
      const responses = [];
      for (const ability of [30, 50, 70, 90]) {
        // Reference group: 18 correct, 2 incorrect
        for (let i = 0; i < 18; i++) responses.push({ isCorrect: 1, totalScore: ability, group: 'reference' });
        for (let i = 0; i < 2; i++) responses.push({ isCorrect: 0, totalScore: ability, group: 'reference' });

        // Focal group with identical ability: only 4 correct, 16 incorrect
        for (let i = 0; i < 4; i++) responses.push({ isCorrect: 1, totalScore: ability, group: 'focal' });
        for (let i = 0; i < 16; i++) responses.push({ isCorrect: 0, totalScore: ability, group: 'focal' });
      }

      const result = calculateMantelHaenszelDIF(responses, 4);

      expect(result.category.level).toBe('C');
      expect(result.category.action).toBe('Quarantine');
      expect(result.isBiased).toBe(true);
      expect(result.isSignificant).toBe(true);
      expect(result.favors).toBe('Reference Group');
    });

    test('Handles small sample sizes safely', () => {
      const small = [{ isCorrect: 1, totalScore: 50, group: 'reference' }];
      const result = calculateMantelHaenszelDIF(small);
      expect(result.category.level).toBe('A');
      expect(result.sampleSize).toBe(1);
    });
  });

  describe('calculateLordsChiSquare', () => {
    test('Non-significant chi-square when item parameters are identical', () => {
      const ref = { b: 0.5, a: 1.2, varB: 0.02, varA: 0.02 };
      const focal = { b: 0.5, a: 1.2, varB: 0.02, varA: 0.02 };

      const res = calculateLordsChiSquare(ref, focal);
      expect(res.chiSquare).toBe(0);
      expect(res.isSignificant).toBe(false);
    });

    test('Significant chi-square when item difficulties diverge significantly', () => {
      const ref = { b: -0.5, a: 1.0, varB: 0.01, varA: 0.01 };
      const focal = { b: 1.8, a: 1.0, varB: 0.01, varA: 0.01 };

      const res = calculateLordsChiSquare(ref, focal);
      expect(res.chiSquare).toBeGreaterThan(15);
      expect(res.isSignificant).toBe(true);
    });
  });
});
