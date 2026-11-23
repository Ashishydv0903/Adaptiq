/**
 * @file Algorithmic Fairness & Bias Auditing Engine
 * Implements Demographic Parity, Disparate Impact (EEOC 80% Four-Fifths Rule),
 * Equalized Odds, and Predictive Parity to audit AI scoring distributions for demographic bias.
 */

export const FAIRNESS_THRESHOLDS = {
  DISPARATE_IMPACT_MIN: 0.80,    // EEOC 4/5ths standard
  DEMOGRAPHIC_PARITY_MAX_DIFF: 0.10, // 10% maximum tolerance
  EQUALIZED_ODDS_MAX_DIFF: 0.10,
  PREDICTIVE_PARITY_MAX_DIFF: 0.10
};

/**
 * Calculates confusion matrix counts for a group.
 *
 * @param {Array<{ actual: boolean|number, predicted: boolean|number }>} samples
 * @returns {{ tp: number, fp: number, tn: number, fn: number, total: number }}
 */
function getConfusionMatrix(samples) {
  let tp = 0;
  let fp = 0;
  let tn = 0;
  let fn = 0;

  for (const s of samples) {
    const actual = Boolean(s.actual);
    const pred = Boolean(s.predicted);

    if (actual && pred) tp++;
    else if (!actual && pred) fp++;
    else if (!actual && !pred) tn++;
    else if (actual && !pred) fn++;
  }

  return { tp, fp, tn, fn, total: samples.length };
}

/**
 * Calculates Demographic Parity metrics between unprivileged and privileged groups.
 *
 * P(Pred = 1 | A = unprivileged) vs P(Pred = 1 | A = privileged)
 *
 * @param {Array<{ predicted: boolean|number }>} unprivilegedSamples
 * @param {Array<{ predicted: boolean|number }>} privilegedSamples
 * @returns {{ unprivilegedRate: number, privilegedRate: number, difference: number, ratio: number, passes: boolean }}
 */
export function calculateDemographicParity(unprivilegedSamples, privilegedSamples) {
  if (unprivilegedSamples.length === 0 || privilegedSamples.length === 0) {
    return {
      unprivilegedRate: 0,
      privilegedRate: 0,
      difference: 0,
      ratio: 1.0,
      passes: true
    };
  }

  const unprivilegedPositive = unprivilegedSamples.filter((s) => Boolean(s.predicted)).length;
  const privilegedPositive = privilegedSamples.filter((s) => Boolean(s.predicted)).length;

  const unprivilegedRate = unprivilegedPositive / unprivilegedSamples.length;
  const privilegedRate = privilegedPositive / privilegedSamples.length;

  const difference = Number(Math.abs(unprivilegedRate - privilegedRate).toFixed(4));
  const ratio = privilegedRate > 0
    ? Number((unprivilegedRate / privilegedRate).toFixed(4))
    : 1.0;

  const passes = difference <= FAIRNESS_THRESHOLDS.DEMOGRAPHIC_PARITY_MAX_DIFF;

  return {
    unprivilegedRate: Number(unprivilegedRate.toFixed(4)),
    privilegedRate: Number(privilegedRate.toFixed(4)),
    difference,
    ratio,
    passes
  };
}

/**
 * Calculates Disparate Impact Ratio (DIR) under EEOC 80% Rule.
 *
 * DIR = Selection Rate (Unprivileged) / Selection Rate (Privileged)
 *
 * @param {Array<{ predicted: boolean|number }>} unprivilegedSamples
 * @param {Array<{ predicted: boolean|number }>} privilegedSamples
 * @returns {{ disparateImpactRatio: number, violatesEEOC: boolean, recommendation: string }}
 */
export function calculateDisparateImpact(unprivilegedSamples, privilegedSamples) {
  const parity = calculateDemographicParity(unprivilegedSamples, privilegedSamples);
  const dir = parity.ratio;
  const violatesEEOC = dir < FAIRNESS_THRESHOLDS.DISPARATE_IMPACT_MIN;

  let recommendation = 'Disparate impact is within acceptable EEOC guidelines.';
  if (violatesEEOC) {
    recommendation = `Adverse impact detected: Unprivileged group selection rate (${(parity.unprivilegedRate * 100).toFixed(1)}%) is less than 80% of privileged group (${(parity.privilegedRate * 100).toFixed(1)}%). Consider recalibrating cutoffs or auditing question DIF.`;
  }

  return {
    disparateImpactRatio: dir,
    violatesEEOC,
    recommendation
  };
}

/**
 * Calculates Equalized Odds metrics (True Positive Rate & False Positive Rate parity).
 *
 * TPR = TP / (TP + FN)
 * FPR = FP / (FP + TN)
 *
 * @param {Array<{ actual: boolean|number, predicted: boolean|number }>} unprivilegedSamples
 * @param {Array<{ actual: boolean|number, predicted: boolean|number }>} privilegedSamples
 * @returns {{ unprivilegedTPR: number, privilegedTPR: number, tprDiff: number, unprivilegedFPR: number, privilegedFPR: number, fprDiff: number, passes: boolean }}
 */
export function calculateEqualizedOdds(unprivilegedSamples, privilegedSamples) {
  const unprivMatrix = getConfusionMatrix(unprivilegedSamples);
  const privMatrix = getConfusionMatrix(privilegedSamples);

  const getTPR = (m) => (m.tp + m.fn > 0 ? m.tp / (m.tp + m.fn) : 1.0);
  const getFPR = (m) => (m.fp + m.tn > 0 ? m.fp / (m.fp + m.tn) : 0.0);

  const unprivTPR = getTPR(unprivMatrix);
  const privTPR = getTPR(privMatrix);

  const unprivFPR = getFPR(unprivMatrix);
  const privFPR = getFPR(privMatrix);

  const tprDiff = Number(Math.abs(unprivTPR - privTPR).toFixed(4));
  const fprDiff = Number(Math.abs(unprivFPR - privFPR).toFixed(4));

  const passes =
    tprDiff <= FAIRNESS_THRESHOLDS.EQUALIZED_ODDS_MAX_DIFF &&
    fprDiff <= FAIRNESS_THRESHOLDS.EQUALIZED_ODDS_MAX_DIFF;

  return {
    unprivilegedTPR: Number(unprivTPR.toFixed(4)),
    privilegedTPR: Number(privTPR.toFixed(4)),
    tprDiff,
    unprivilegedFPR: Number(unprivFPR.toFixed(4)),
    privilegedFPR: Number(privFPR.toFixed(4)),
    fprDiff,
    passes
  };
}

/**
 * Calculates Predictive Parity (Positive Predictive Value / Precision parity).
 *
 * PPV = TP / (TP + FP)
 *
 * @param {Array<{ actual: boolean|number, predicted: boolean|number }>} unprivilegedSamples
 * @param {Array<{ actual: boolean|number, predicted: boolean|number }>} privilegedSamples
 * @returns {{ unprivilegedPPV: number, privilegedPPV: number, difference: number, passes: boolean }}
 */
export function calculatePredictiveParity(unprivilegedSamples, privilegedSamples) {
  const unprivMatrix = getConfusionMatrix(unprivilegedSamples);
  const privMatrix = getConfusionMatrix(privilegedSamples);

  const getPPV = (m) => (m.tp + m.fp > 0 ? m.tp / (m.tp + m.fp) : 1.0);

  const unprivPPV = getPPV(unprivMatrix);
  const privPPV = getPPV(privMatrix);

  const difference = Number(Math.abs(unprivPPV - privPPV).toFixed(4));
  const passes = difference <= FAIRNESS_THRESHOLDS.PREDICTIVE_PARITY_MAX_DIFF;

  return {
    unprivilegedPPV: Number(unprivPPV.toFixed(4)),
    privilegedPPV: Number(privPPV.toFixed(4)),
    difference,
    passes
  };
}

/**
 * Generates an end-to-end Fair Assessment Audit Report.
 *
 * @param {Array<{ demographicGroup: string, actual: boolean|number, predicted: boolean|number, score: number }>} dataset
 * @param {string} privilegedGroup - Value of privileged group (e.g. 'majority' or 'male')
 * @returns {Object} Comprehensive audit report with flags and compliance status
 */
export function generateFairnessAuditReport(dataset, privilegedGroup) {
  const privileged = dataset.filter((d) => d.demographicGroup === privilegedGroup);
  const unprivileged = dataset.filter((d) => d.demographicGroup !== privilegedGroup);

  if (privileged.length === 0 || unprivileged.length === 0) {
    return {
      status: 'INSUFFICIENT_DATA',
      message: 'Both privileged and unprivileged groups must have at least 1 record for fairness auditing.'
    };
  }

  const demographicParity = calculateDemographicParity(unprivileged, privileged);
  const disparateImpact = calculateDisparateImpact(unprivileged, privileged);
  const equalizedOdds = calculateEqualizedOdds(unprivileged, privileged);
  const predictiveParity = calculatePredictiveParity(unprivileged, privileged);

  const flags = [];
  if (disparateImpact.violatesEEOC) {
    flags.push({
      metric: 'Disparate Impact',
      severity: 'CRITICAL',
      message: disparateImpact.recommendation
    });
  }
  if (!demographicParity.passes) {
    flags.push({
      metric: 'Demographic Parity',
      severity: 'WARNING',
      message: `Difference in selection rates (${(demographicParity.difference * 100).toFixed(1)}%) exceeds allowable threshold.`
    });
  }
  if (!equalizedOdds.passes) {
    flags.push({
      metric: 'Equalized Odds',
      severity: 'WARNING',
      message: `Error rate disparity detected between groups (TPR diff: ${equalizedOdds.tprDiff}, FPR diff: ${equalizedOdds.fprDiff}).`
    });
  }

  const isCompliant = flags.filter((f) => f.severity === 'CRITICAL').length === 0;

  return {
    auditDate: new Date().toISOString(),
    sampleSize: {
      total: dataset.length,
      privileged: privileged.length,
      unprivileged: unprivileged.length
    },
    metrics: {
      demographicParity,
      disparateImpact,
      equalizedOdds,
      predictiveParity
    },
    isCompliant,
    flags
  };
}

/**
 * Calculates Group Mean Score Gap between privileged and unprivileged groups.
 *
 * @param {number[]} groupAValues - Scores of Group A (e.g., privileged / reference)
 * @param {number[]} groupBValues - Scores of Group B (e.g., unprivileged / focal)
 * @returns {{ meanA: number, meanB: number, gap: number, percentageGap: number, sampleSizeA: number, sampleSizeB: number }}
 */
export function calculateGroupMeanGap(groupAValues = [], groupBValues = []) {
  if (!groupAValues.length || !groupBValues.length) {
    return {
      meanA: groupAValues.length ? Number((groupAValues.reduce((a, b) => a + b, 0) / groupAValues.length).toFixed(2)) : 0,
      meanB: groupBValues.length ? Number((groupBValues.reduce((a, b) => a + b, 0) / groupBValues.length).toFixed(2)) : 0,
      gap: 0,
      percentageGap: 0,
      sampleSizeA: groupAValues.length,
      sampleSizeB: groupBValues.length
    };
  }

  const sumA = groupAValues.reduce((a, b) => a + b, 0);
  const sumB = groupBValues.reduce((a, b) => a + b, 0);

  const meanA = Number((sumA / groupAValues.length).toFixed(2));
  const meanB = Number((sumB / groupBValues.length).toFixed(2));
  const gap = Number((meanA - meanB).toFixed(2));
  const percentageGap = meanA > 0 ? Number(((gap / meanA) * 100).toFixed(2)) : 0;

  return {
    meanA,
    meanB,
    gap,
    percentageGap,
    sampleSizeA: groupAValues.length,
    sampleSizeB: groupBValues.length
  };
}

/**
 * Calculates Cohen's d effect size for group mean difference with pooled standard deviation.
 *
 * d = (meanA - meanB) / s_pooled
 * s_pooled = sqrt(((n1-1)s1^2 + (n2-1)s2^2) / (n1 + n2 - 2))
 *
 * @param {number[]} groupAValues - Scores of Group A
 * @param {number[]} groupBValues - Scores of Group B
 * @returns {{ d: number, pooledStdDev: number, interpretation: string, isDisparitySignificant: boolean }}
 */
export function calculateCohensD(groupAValues = [], groupBValues = []) {
  const n1 = groupAValues.length;
  const n2 = groupBValues.length;

  if (n1 < 2 || n2 < 2) {
    return {
      d: 0,
      pooledStdDev: 0,
      interpretation: 'insufficient_sample',
      isDisparitySignificant: false
    };
  }

  const meanA = groupAValues.reduce((a, b) => a + b, 0) / n1;
  const meanB = groupBValues.reduce((a, b) => a + b, 0) / n2;

  const varA = groupAValues.reduce((acc, val) => acc + Math.pow(val - meanA, 2), 0) / (n1 - 1);
  const varB = groupBValues.reduce((acc, val) => acc + Math.pow(val - meanB, 2), 0) / (n2 - 1);

  const pooledVar = ((n1 - 1) * varA + (n2 - 1) * varB) / (n1 + n2 - 2);
  const pooledStdDev = Math.sqrt(Math.max(0, pooledVar));

  if (pooledStdDev === 0) {
    return {
      d: 0,
      pooledStdDev: 0,
      interpretation: 'negligible',
      isDisparitySignificant: false
    };
  }

  const d = Number(((meanA - meanB) / pooledStdDev).toFixed(4));
  const absD = Math.abs(d);

  let interpretation = 'negligible';
  if (absD >= 0.8) {
    interpretation = 'large';
  } else if (absD >= 0.5) {
    interpretation = 'medium';
  } else if (absD >= 0.2) {
    interpretation = 'small';
  }

  return {
    d,
    pooledStdDev: Number(pooledStdDev.toFixed(4)),
    interpretation,
    isDisparitySignificant: absD >= 0.50
  };
}

/**
 * Calculates selection-rate ratio under the EEOC 80% (Four-Fifths) rule.
 *
 * Selection Rate Ratio = Selection Rate (Unprivileged) / Selection Rate (Privileged)
 *
 * @param {Array<number|{ score?: number, predicted?: boolean }>} unprivilegedSamples
 * @param {Array<number|{ score?: number, predicted?: boolean }>} privilegedSamples
 * @param {number} [cutoffScore=70] - Score threshold for selection
 * @returns {{ selectionRateUnprivileged: number, selectionRatePrivileged: number, selectionRateRatio: number, violates80Rule: boolean, shortfall: number, recommendation: string }}
 */
export function calculateSelectionRateRatio(unprivilegedSamples = [], privilegedSamples = [], cutoffScore = 70) {
  const isSelected = (item) => {
    if (typeof item === 'number') return item >= cutoffScore;
    if (item && typeof item.score === 'number') return item.score >= cutoffScore;
    if (item && typeof item.predicted !== 'undefined') return Boolean(item.predicted);
    return false;
  };

  const nUnpriv = unprivilegedSamples.length;
  const nPriv = privilegedSamples.length;

  if (nUnpriv === 0 || nPriv === 0) {
    return {
      selectionRateUnprivileged: 0,
      selectionRatePrivileged: 0,
      selectionRateRatio: 1.0,
      violates80Rule: false,
      shortfall: 0,
      recommendation: 'Insufficient sample size to evaluate the 80% rule.'
    };
  }

  const selectedUnpriv = unprivilegedSamples.filter(isSelected).length;
  const selectedPriv = privilegedSamples.filter(isSelected).length;

  const rateUnpriv = Number((selectedUnpriv / nUnpriv).toFixed(4));
  const ratePriv = Number((selectedPriv / nPriv).toFixed(4));

  const ratio = ratePriv > 0 ? Number((rateUnpriv / ratePriv).toFixed(4)) : 1.0;
  const violates80Rule = ratio < FAIRNESS_THRESHOLDS.DISPARATE_IMPACT_MIN;

  // Shortfall: number of additional unprivileged selections needed to meet 80% benchmark
  const targetSelections = Math.ceil(FAIRNESS_THRESHOLDS.DISPARATE_IMPACT_MIN * ratePriv * nUnpriv);
  const shortfall = Math.max(0, targetSelections - selectedUnpriv);

  let recommendation = 'Compliant with EEOC 80% (Four-Fifths) rule.';
  if (violates80Rule) {
    recommendation = `Adverse impact detected: Selection rate ratio (${(ratio * 100).toFixed(1)}%) is below 80%. Shortfall: ${shortfall} candidate(s). Item difficulty or scoring cutoff adjustments recommended.`;
  }

  return {
    selectionRateUnprivileged: rateUnpriv,
    selectionRatePrivileged: ratePriv,
    selectionRateRatio: ratio,
    violates80Rule,
    shortfall,
    recommendation
  };
}
