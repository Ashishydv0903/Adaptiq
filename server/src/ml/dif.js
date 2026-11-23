/**
 * @file Differential Item Functioning (DIF) Detection Engine
 * Implements Mantel-Haenszel (MH) test, MH Delta DIF statistic,
 * Educational Testing Service (ETS) classifications (Category A, B, C),
 * and Lord's Chi-Square to detect biased or unfair questions across demographic groups.
 */

export const ETS_CATEGORIES = {
  A: { level: 'A', severity: 'Negligible', action: 'Approved' },
  B: { level: 'B', severity: 'Slight/Moderate', action: 'Review' },
  C: { level: 'C', severity: 'Severe', action: 'Quarantine' }
};

/**
 * Computes Mantel-Haenszel DIF statistics for a specific test item.
 *
 * @param {Array<{
 *   isCorrect: boolean|number,
 *   totalScore: number,
 *   group: 'reference'|'focal'
 * }>} candidateResponses - Array of candidate attempts on this question
 * @param {number} [numStrata=4] - Number of ability strata to divide candidates into
 * @returns {Object} Comprehensive MH DIF evaluation
 */
export function calculateMantelHaenszelDIF(candidateResponses, numStrata = 4) {
  if (!candidateResponses || candidateResponses.length < 10) {
    return {
      category: ETS_CATEGORIES.A,
      deltaMH: 0,
      alphaMH: 1.0,
      chiSquare: 0,
      pValue: 1.0,
      isBiased: false,
      sampleSize: candidateResponses ? candidateResponses.length : 0,
      note: 'Sample size too small for statistical DIF determination.'
    };
  }

  // Determine score strata bounds
  const scores = candidateResponses.map((r) => r.totalScore);
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  const scoreRange = Math.max(1, maxScore - minScore);
  const stratumWidth = scoreRange / numStrata;

  // Build strata contingency tables
  const strata = Array.from({ length: numStrata }, () => ({
    A: 0, // Reference correct
    B: 0, // Reference incorrect
    C: 0, // Focal correct
    D: 0, // Focal incorrect
    NR: 0,
    NF: 0,
    T: 0
  }));

  for (const resp of candidateResponses) {
    const sIndex = Math.min(
      numStrata - 1,
      Math.floor((resp.totalScore - minScore) / stratumWidth)
    );
    const table = strata[sIndex];
    const isCorrect = Boolean(resp.isCorrect);

    if (resp.group === 'reference') {
      table.NR++;
      if (isCorrect) table.A++;
      else table.B++;
    } else {
      table.NF++;
      if (isCorrect) table.C++;
      else table.D++;
    }
    table.T++;
  }

  // Filter strata with both reference and focal representation and variation
  const validStrata = strata.filter(
    (t) => t.NR > 0 && t.NF > 0 && (t.A + t.C > 0) && (t.B + t.D > 0)
  );

  if (validStrata.length === 0) {
    return {
      category: ETS_CATEGORIES.A,
      deltaMH: 0,
      alphaMH: 1.0,
      chiSquare: 0,
      pValue: 1.0,
      isBiased: false,
      sampleSize: candidateResponses.length,
      note: 'No matched strata had representation from both groups.'
    };
  }

  let numeratorAlpha = 0;
  let denominatorAlpha = 0;
  let sumObservedA = 0;
  let sumExpectedA = 0;
  let sumVarA = 0;

  for (const t of validStrata) {
    const M1 = t.A + t.C; // Total correct in stratum
    const M0 = t.B + t.D; // Total incorrect in stratum
    const T = t.T;

    numeratorAlpha += (t.A * t.D) / T;
    denominatorAlpha += (t.B * t.C) / T;

    const expectedA = (t.NR * M1) / T;
    const varA = (t.NR * t.NF * M1 * M0) / (T * T * Math.max(1, T - 1));

    sumObservedA += t.A;
    sumExpectedA += expectedA;
    sumVarA += varA;
  }

  // Safe odds ratio calculation
  let alphaMH = 1.0;
  if (denominatorAlpha > 0) {
    alphaMH = numeratorAlpha / denominatorAlpha;
  } else if (numeratorAlpha > 0) {
    alphaMH = 10.0; // strong focal disadvantage
  }

  alphaMH = Math.max(0.01, Math.min(100, alphaMH));

  // ETS Delta DIF statistic: Delta_MH = -2.35 * ln(alpha_MH)
  const deltaMH = Number((-2.35 * Math.log(alphaMH)).toFixed(3));

  // Mantel-Haenszel Chi-Square with continuity correction
  let chiSquare = 0;
  if (sumVarA > 1e-6) {
    const diff = Math.abs(sumObservedA - sumExpectedA) - 0.5;
    chiSquare = diff > 0 ? (diff * diff) / sumVarA : 0;
  }
  chiSquare = Number(chiSquare.toFixed(3));

  // 1-degree of freedom p-value approximation
  // chi-sq critical values: 3.84 for p=0.05, 6.63 for p=0.01
  const isSignificant = chiSquare >= 3.841;
  const pValue = isSignificant
    ? chiSquare >= 6.635
      ? 0.01
      : 0.05
    : 0.20;

  // Educational Testing Service (ETS) Classification Rules:
  // Category A: |Delta| < 1.0 or not significant -> negligible DIF
  // Category B: 1.0 <= |Delta| < 1.5 and significant -> slight to moderate DIF
  // Category C: |Delta| >= 1.5 and significant -> severe DIF
  const absDelta = Math.abs(deltaMH);
  let category = ETS_CATEGORIES.A;

  if (isSignificant) {
    if (absDelta >= 1.5) {
      category = ETS_CATEGORIES.C;
    } else if (absDelta >= 1.0) {
      category = ETS_CATEGORIES.B;
    }
  }

  const favors = deltaMH > 0 ? 'Focal Group' : deltaMH < 0 ? 'Reference Group' : 'Neither';

  return {
    category,
    deltaMH,
    alphaMH: Number(alphaMH.toFixed(3)),
    chiSquare,
    pValue,
    isSignificant,
    isBiased: category.level === 'C',
    favors,
    sampleSize: candidateResponses.length,
    validStrataCount: validStrata.length,
    recommendation: category.action
  };
}

/**
 * Lord's Chi-Square Test to compare IRT item parameters (b_ref, a_ref) vs (b_focal, a_focal).
 *
 * @param {Object} refParams - { b: number, a: number, varB: number, varA: number }
 * @param {Object} focalParams - { b: number, a: number, varB: number, varA: number }
 * @returns {{ chiSquare: number, pValue: number, isSignificant: boolean }}
 */
export function calculateLordsChiSquare(refParams, focalParams) {
  const diffB = refParams.b - focalParams.b;
  const diffA = (refParams.a ?? 1.0) - (focalParams.a ?? 1.0);

  const varB = (refParams.varB ?? 0.05) + (focalParams.varB ?? 0.05);
  const varA = (refParams.varA ?? 0.05) + (focalParams.varA ?? 0.05);

  const chiB = (diffB * diffB) / Math.max(1e-5, varB);
  const chiA = (diffA * diffA) / Math.max(1e-5, varA);
  const totalChi = Number((chiB + chiA).toFixed(3));

  // 2 degrees of freedom critical value for alpha=0.05 is 5.991
  const isSignificant = totalChi >= 5.991;

  return {
    chiSquare: totalChi,
    pValue: isSignificant ? (totalChi >= 9.21 ? 0.01 : 0.05) : 0.20,
    isSignificant
  };
}

/**
 * Batch evaluates Mantel-Haenszel DIF across all test questions.
 *
 * @param {Array<{ questionId: string, title: string, track: string, responses: Array<{ isCorrect: boolean|number, totalScore: number, group: 'reference'|'focal' }> }>} items
 * @returns {{ summary: { totalEvaluated: number, approvedCount: number, reviewCount: number, quarantinedCount: number }, results: Array<Object> }}
 */
export function batchAnalyzeQuestionsDIF(items = []) {
  const results = items.map((item) => {
    const difResult = calculateMantelHaenszelDIF(item.responses || []);
    const isQuarantined = difResult.category.level === 'C';

    return {
      questionId: item.questionId,
      title: item.title,
      track: item.track,
      sampleSize: difResult.sampleSize,
      deltaMH: difResult.deltaMH,
      alphaMH: difResult.alphaMH,
      category: difResult.category.level,
      categoryDetails: difResult.category,
      pValue: difResult.pValue,
      favors: difResult.favors,
      isBiased: difResult.isBiased,
      isQuarantined,
      action: difResult.recommendation
    };
  });

  const summary = {
    totalEvaluated: results.length,
    approvedCount: results.filter((r) => r.category === 'A').length,
    reviewCount: results.filter((r) => r.category === 'B').length,
    quarantinedCount: results.filter((r) => r.category === 'C').length
  };

  return { summary, results };
}
