/**
 * @file Speech Delivery Metrics Service
 * Computes Words Per Minute (WPM), filler words count and ratio,
 * pause ratio, and speech delivery effectiveness scoring.
 */

export const STANDARD_FILLER_WORDS = [
  // English standard fillers
  'um',
  'uh',
  'er',
  'ah',
  'like',
  'you know',
  'basically',
  'actually',
  'literally',
  'so yeah',
  'i mean',
  'sort of',
  'kind of',
  'right',
  'okay so',
  // Hindi & Hinglish fillers
  'matlab',
  'mtlb',
  'yaani',
  'yani',
  'achha',
  'acha',
  'samjho',
  'bhai',
  'toh',
  'haina',
  'hai na',
  'dekho',
  'waise',
  'matlab ki'
];

/**
 * Evaluates speech metrics from audio transcript and duration.
 *
 * @param {Object} params
 * @param {string} params.transcript - Transcribed speech text
 * @param {number} params.durationSeconds - Audio duration in seconds
 * @param {Array<number>} [params.pauseIntervals=[]] - Optional timestamps of silence intervals
 * @returns {Object} Structured speech delivery metrics
 */
export function calculateSpeechMetrics({ transcript = '', durationSeconds = 30, pauseIntervals = [] }) {
  const cleanedText = transcript.trim();
  const words = cleanedText ? cleanedText.split(/\s+/).filter(Boolean) : [];
  const wordCount = words.length;
  const safeDuration = Math.max(5, durationSeconds);
  const durationMinutes = safeDuration / 60;

  // 1. Words Per Minute (WPM)
  const rawWpm = durationMinutes > 0 ? Math.round(wordCount / durationMinutes) : 0;
  const wpm = Math.min(260, Math.max(0, rawWpm));

  let wpmRating = 'Ideal & Conversational';
  if (wpm < 100) wpmRating = 'Too Slow';
  else if (wpm < 120) wpmRating = 'Measured';
  else if (wpm <= 165) wpmRating = 'Ideal & Conversational';
  else if (wpm <= 190) wpmRating = 'Fast Pace';
  else wpmRating = 'Rushed';

  // 2. Filler Words Detection
  const lowerText = cleanedText.toLowerCase();
  let fillerCount = 0;
  const fillerBreakdown = {};

  for (const filler of STANDARD_FILLER_WORDS) {
    // Regex for whole word / phrase match
    const regex = new RegExp(`\\b${filler}\\b`, 'gi');
    const matches = lowerText.match(regex);
    if (matches && matches.length > 0) {
      fillerCount += matches.length;
      fillerBreakdown[filler] = matches.length;
    }
  }

  const fillerRatio = wordCount > 0 ? Number(((fillerCount / wordCount) * 100).toFixed(1)) : 0;

  // 3. Pause Ratio / Silent Pauses
  let pauseSeconds = 0;
  if (pauseIntervals && pauseIntervals.length > 0) {
    pauseSeconds = pauseIntervals.reduce((sum, p) => sum + (typeof p === 'number' ? p : p.duration || 0), 0);
  } else {
    // Estimate pause ratio based on expected speech density (average ~2.5 words/sec)
    const expectedSpeechDuration = wordCount * 0.38; // ~158 WPM speech
    pauseSeconds = Math.max(0, safeDuration - expectedSpeechDuration);
  }

  const rawPauseRatio = safeDuration > 0 ? pauseSeconds / safeDuration : 0.15;
  const pauseRatio = Number(Math.max(0.05, Math.min(0.50, rawPauseRatio)).toFixed(2));

  // 4. Overall Delivery Score (0 to 100)
  // WPM penalty: optimum is 135-155 WPM
  const wpmDiff = Math.abs(wpm - 145);
  const wpmPenalty = Math.min(30, (wpmDiff / 10) * 4);

  // Filler penalty: > 4% starts deducting points
  const fillerPenalty = Math.min(35, fillerRatio * 3.5);

  // Pause penalty: > 35% pause ratio starts deducting
  const pausePenalty = pauseRatio > 0.30 ? Math.min(25, (pauseRatio - 0.30) * 80) : 0;

  const deliveryScore = Math.max(30, Math.round(100 - wpmPenalty - fillerPenalty - pausePenalty));

  // 5. Actionable Coaching Tips
  const coachingTips = [];
  if (wpm < 115) {
    coachingTips.push('Pace is somewhat deliberate. Try slightly accelerating your technical delivery to project confident command.');
  } else if (wpm > 175) {
    coachingTips.push('Fast speaking pace detected. Deliberately slow down on architectural milestones to allow the interviewer to absorb details.');
  }

  if (fillerRatio > 4.5) {
    const topFiller = Object.keys(fillerBreakdown)[0] || 'fillers';
    coachingTips.push(`Frequent filler word usage ("${topFiller}"). Replace fillers with brief 1-second silent pauses while formulating thoughts.`);
  }

  if (pauseRatio > 0.35) {
    coachingTips.push('Extended pauses observed between sentences. Structure your thoughts using the STAR framework to keep flow continuous.');
  }

  if (coachingTips.length === 0) {
    coachingTips.push('Exceptional conversational pacing and crisp delivery with minimal filler hesitation.');
  }

  return {
    wpm,
    wpmRating,
    wordCount,
    durationSeconds: safeDuration,
    fillerCount,
    fillerRatio,
    fillerBreakdown,
    pauseRatio,
    deliveryScore,
    coachingTips
  };
}
