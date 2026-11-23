/**
 * @file Anti-Cheating & Integrity Proctoring Engine
 * Evaluates real-time candidate integrity telemetry:
 * Tab switches, fullscreen exits, paste bursts, typing dynamics anomalies, and AI-text indicators.
 */

export const INTEGRITY_PENALTIES = {
  tab_switch: { initial: 2, repeat: 5, severity: 'WARNING' },
  window_blur: { initial: 2, repeat: 5, severity: 'WARNING' },
  fullscreen_exit: { initial: 5, repeat: 8, severity: 'WARNING' },
  paste: { initial: 4, largeBurst: 8, severity: 'WARNING' },
  paste_anomaly: { initial: 8, repeat: 10, severity: 'HIGH' },
  typing_anomaly: { initial: 8, repeat: 12, severity: 'HIGH' },
  ai_text_risk_indicator: { moderate: 8, high: 15, severity: 'CRITICAL' },
  time_expired_anomaly: { initial: 5, repeat: 5, severity: 'WARNING' },
  multiple_faces: { initial: 10, repeat: 15, severity: 'CRITICAL' }
};

export const REVIEW_THRESHOLD = 75; // Sessions falling below this score are automatically flagged for review

/**
 * Analyzes typing cadence and keystroke dynamics to detect copy-paste bursts or script injection.
 *
 * @param {Object} params
 * @param {string} params.text - Submitted answer text
 * @param {number} params.durationSeconds - Time spent answering in seconds
 * @param {number} [params.keystrokeCount=0] - Recorded physical keystrokes
 * @param {number} [params.pasteCount=0] - Number of clipboard pastes
 * @returns {{ isAnomaly: boolean, calculatedWpm: number, riskLevel: 'LOW'|'MEDIUM'|'HIGH', reason: string }}
 */
export function detectTypingAnomaly({ text = '', durationSeconds = 1, keystrokeCount = 0, pasteCount = 0 }) {
  const clean = text.trim();
  if (!clean) {
    return { isAnomaly: false, calculatedWpm: 0, riskLevel: 'LOW', reason: 'Empty response' };
  }

  const words = clean.split(/\s+/).length;
  const chars = clean.length;
  const safeSeconds = Math.max(1, durationSeconds);
  const calculatedWpm = Math.round((words / safeSeconds) * 60);

  // Inhuman typing speed (> 190 WPM sustained on prose)
  if (calculatedWpm > 190 && words > 20) {
    return {
      isAnomaly: true,
      calculatedWpm,
      riskLevel: 'HIGH',
      reason: `Inhuman typing speed detected (${calculatedWpm} WPM for ${words} words in ${safeSeconds}s). Potential automated paste.`
    };
  }

  // Large character count with virtually zero recorded physical keystrokes
  if (chars >= 70 && keystrokeCount > 0 && chars / keystrokeCount >= 4.0) {
    return {
      isAnomaly: true,
      calculatedWpm,
      riskLevel: 'HIGH',
      reason: `Severe keystroke disparity: ${chars} characters generated from only ${keystrokeCount} keystrokes.`
    };
  }

  // Elevated paste frequency
  if (pasteCount >= 3 && words > 30) {
    return {
      isAnomaly: true,
      calculatedWpm,
      riskLevel: 'MEDIUM',
      reason: `Repeated external clipboard insertions detected (${pasteCount} distinct paste operations).`
    };
  }

  return {
    isAnomaly: false,
    calculatedWpm,
    riskLevel: 'LOW',
    reason: 'Typing rhythm and keystroke velocity within natural human distribution.'
  };
}

/**
 * Heuristic & stylistic entropy analyzer for AI-generated text.
 * Flags token repetition, uniform sentence lengths, and stereotypical LLM markers.
 *
 * @param {string} text - Candidate response text
 * @returns {{ aiProbability: number, riskLevel: 'LOW'|'MEDIUM'|'HIGH', detectedPatterns: string[], isFlagged: boolean }}
 */
export function calculateAITextRisk(text = '') {
  const clean = text.trim();
  if (clean.length < 80) {
    return {
      aiProbability: 0.15,
      riskLevel: 'LOW',
      detectedPatterns: [],
      isFlagged: false
    };
  }

  const lower = clean.toLowerCase();
  const detectedPatterns = [];

  // Common high-frequency LLM transitional idioms
  const LLM_MARKERS = [
    { pattern: 'it is important to note', weight: 0.18 },
    { pattern: 'in conclusion', weight: 0.14 },
    { pattern: 'furthermore', weight: 0.10 },
    { pattern: 'moreover', weight: 0.10 },
    { pattern: 'delve into', weight: 0.22 },
    { pattern: 'testament to', weight: 0.20 },
    { pattern: 'a comprehensive overview', weight: 0.16 },
    { pattern: 'vital role in ensuring', weight: 0.15 },
    { pattern: 'it is worth mentioning', weight: 0.16 },
    { pattern: 'seamlessly integrate', weight: 0.18 }
  ];

  let rawRisk = 0.10; // Baseline prior probability

  for (const marker of LLM_MARKERS) {
    if (lower.includes(marker.pattern)) {
      detectedPatterns.push(marker.pattern);
      rawRisk += marker.weight;
    }
  }

  // Sentence length variance check (AI texts exhibit low sentence length variance)
  const sentences = clean.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
  if (sentences.length >= 4) {
    const lengths = sentences.map((s) => s.split(/\s+/).length);
    const meanLen = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const variance = lengths.reduce((acc, l) => acc + Math.pow(l - meanLen, 2), 0) / lengths.length;
    const stdDev = Math.sqrt(variance);

    // If sentences are very uniformly 14-22 words with near zero variance
    if (stdDev < 2.5 && meanLen >= 12) {
      rawRisk += 0.25;
      detectedPatterns.push('Low sentence-length burstiness (uniform cadence)');
    }
  }

  // High lexical diversity / zero grammatical friction
  const words = lower.match(/\b[a-z]{3,}\b/g) || [];
  if (words.length > 50) {
    const unique = new Set(words).size;
    const typeTokenRatio = unique / words.length;
    if (typeTokenRatio > 0.85) {
      rawRisk += 0.15;
    }
  }

  const aiProbability = Number(Math.min(0.99, Math.max(0.05, rawRisk)).toFixed(2));
  const isFlagged = aiProbability >= 0.70;

  let riskLevel = 'LOW';
  if (aiProbability >= 0.70) riskLevel = 'HIGH';
  else if (aiProbability >= 0.45) riskLevel = 'MEDIUM';

  return {
    aiProbability,
    riskLevel,
    detectedPatterns,
    isFlagged
  };
}

/**
 * Calculates updated integrity score from accumulated event logs.
 *
 * @param {Array<{ eventType: string, timestamp?: Date|string, metadata?: any }>} events
 * @param {number} [initialScore=100]
 * @returns {{ currentScore: number, finalScore: number, totalDeductions: number, timeline: Array<any>, isFlaggedForReview: boolean, primaryFlagReason: string }}
 */
export function calculateSessionIntegrityScore(events = [], initialScore = 100) {
  let score = initialScore;
  const eventCounts = {};
  const timeline = [];
  let primaryFlagReason = '';

  for (const ev of events) {
    const type = ev.eventType || 'tab_switch';
    eventCounts[type] = (eventCounts[type] || 0) + 1;
    const count = eventCounts[type];

    let deduction = 0;
    let severity = 'INFO';

    switch (type) {
      case 'tab_switch':
      case 'window_blur':
        deduction = count === 1 ? INTEGRITY_PENALTIES.tab_switch.initial : INTEGRITY_PENALTIES.tab_switch.repeat;
        severity = count === 1 ? 'INFO' : 'WARNING';
        break;

      case 'fullscreen_exit':
        deduction = count === 1 ? INTEGRITY_PENALTIES.fullscreen_exit.initial : INTEGRITY_PENALTIES.fullscreen_exit.repeat;
        severity = 'WARNING';
        break;

      case 'paste':
      case 'paste_anomaly':
        const charCount = ev.metadata?.charCount || 0;
        if (charCount > 100) {
          deduction = INTEGRITY_PENALTIES.paste.largeBurst;
          severity = 'HIGH';
        } else {
          deduction = INTEGRITY_PENALTIES.paste.initial;
          severity = 'WARNING';
        }
        break;

      case 'typing_anomaly':
        deduction = INTEGRITY_PENALTIES.typing_anomaly.initial;
        severity = 'HIGH';
        break;

      case 'ai_text_risk_indicator':
        const prob = ev.metadata?.aiProbability || 0.8;
        deduction = prob >= 0.7 ? INTEGRITY_PENALTIES.ai_text_risk_indicator.high : INTEGRITY_PENALTIES.ai_text_risk_indicator.moderate;
        severity = 'CRITICAL';
        if (!primaryFlagReason) primaryFlagReason = 'High AI-Generated Content Risk';
        break;

      case 'multiple_faces':
        deduction = INTEGRITY_PENALTIES.multiple_faces.initial;
        severity = 'CRITICAL';
        if (!primaryFlagReason) primaryFlagReason = 'Multiple faces detected in camera feed';
        break;

      case 'time_expired_anomaly':
        deduction = INTEGRITY_PENALTIES.time_expired_anomaly.initial;
        severity = 'WARNING';
        break;

      default:
        deduction = 2;
        severity = 'INFO';
        break;
    }

    score = Math.max(0, score - deduction);

    timeline.push({
      eventType: type,
      timestamp: ev.timestamp || new Date(),
      metadata: ev.metadata || {},
      severity,
      deduction,
      resultingScore: score
    });
  }

  const isFlaggedForReview = score < REVIEW_THRESHOLD || Boolean(primaryFlagReason);
  if (isFlaggedForReview && !primaryFlagReason) {
    primaryFlagReason = `Cumulative integrity score dropped below ${REVIEW_THRESHOLD} (${score}/100)`;
  }

  return {
    currentScore: score,
    finalScore: score,
    totalDeductions: initialScore - score,
    timeline,
    isFlaggedForReview,
    primaryFlagReason
  };
}

export default {
  detectTypingAnomaly,
  calculateAITextRisk,
  calculateSessionIntegrityScore,
  INTEGRITY_PENALTIES,
  REVIEW_THRESHOLD
};