/**
 * @file Proctoring Configuration & Escalation Rules Engine
 * Configurable thresholds for AI proctoring, event severities, and multi-strike escalation.
 */

export const proctorConfigs = {
  consentVersion: '1.0.0',
  samplingIntervalMs: 500, // Web worker checks frame every ~500ms
  retentionDays: 30, // Evidence retention policy (days)
  onRed: 'pause', // Action on Red proctor alert: 'continue' | 'pause' | 'terminate'

  // Escalation rules
  escalation: {
    yellowsToOrange: 3, // 3 yellow infractions escalate to orange
    orangesToRed: 3     // 3 oranges become a red
  },

  evidence: {
    rollingBufferSeconds: 10,
    storageProvider: process.env.PROCTOR_STORAGE_PROVIDER || 'gridfs',
    retentionDays: 30,
    onRed: 'pause'
  },

  // Environmental & biometric thresholds
  thresholds: {
    lighting: {
      minLuminance: 40,   // Below this is camera blocked / too dark
      maxLuminance: 235   // Above this is overexposed
    },
    headPose: {
      maxYawDeg: 25,      // Head turn left/right > 25°
      maxPitchDeg: 20     // Head tilt up/down > 20°
    },
    iris: {
      maxGazeDeviation: 0.28 // Gaze deviation from screen center
    },
    durations: {
      lookingAwayYellowMs: 1500,
      lookingAwayOrangeMs: 3500,
      noFaceYellowMs: 1200,
      noFaceOrangeMs: 3000
    },
    identity: {
      maxEmbeddingDistance: 0.42 // Euclidean distance threshold for 128-d face embedding
    },
    prohibitedObjects: [
      'cell phone',
      'mobile phone',
      'phone',
      'book',
      'laptop',
      'tablet'
    ],
    // Browser behaviour thresholds
    browser: {
      largePasteChars: 80,
      virtualCameraKeywords: [
        'obs',
        'virtual',
        'manycam',
        'v4l2loopback',
        'droidcam',
        'fake',
        'camo',
        'xsplit',
        'ndi'
      ],
      devtoolsKeys: ['f12', 'i', 'j', 'c', 'u']
    },
    // Typing pattern anomaly thresholds
    typing: {
      minKeystrokesForIkiAnalysis: 15,
      uniformIkiStdDevMs: 12, // Inter-keystroke interval std dev < 12ms indicates bot/synthetic injection
      maxHumanWpm: 190,
      fastAnswerMinChars: 100,
      fastAnswerMaxSeconds: 3
    },
    // Audio analysis thresholds (Web Audio API)
    audio: {
      speechThresholdRatio: 0.16,
      silentNoiseFloorRatio: 0.04,
      twoSpeakerFormantVarianceThreshold: 0.35,
      writeModeSpeechDurationMs: 1200
    },
    // Time-decay parameters
    timeDecay: {
      halfLifeMinutes: 15, // Penalties decay with a 15-minute half-life
      initialScore: 100
    }
  },

  // Base severities for proctoring event types
  baseSeverityMap: {
    // Face & vision
    LOOKING_AWAY: 'yellow',
    NO_FACE: 'yellow',
    MULTIPLE_FACES: 'orange',
    IDENTITY_MISMATCH: 'red',
    PROHIBITED_OBJECT: 'orange',
    CAMERA_BLOCKED_DARK: 'orange',
    DEVICE_DISCONNECTED: 'orange',

    // Browser behaviour
    TAB_SWITCH: 'yellow',
    WINDOW_BLUR: 'yellow',
    FULLSCREEN_EXIT: 'orange',
    CLIPBOARD_ACTION: 'yellow',
    RIGHT_CLICK: 'yellow',
    DEVTOOLS_SHORTCUT: 'orange',
    WINDOW_RESIZE_EXTRA_MONITOR: 'orange',
    VIRTUAL_CAMERA: 'orange',

    // Typing pattern anomalies
    TYPING_ANOMALY_LARGE_PASTE: 'orange',
    TYPING_ANOMALY_UNIFORM_KEYSTROKES: 'orange',
    IMPLAUSIBLY_FAST_ANSWER: 'orange',

    // AI-generated text risk indicator (labelled as risk indicator only)
    AI_TEXT_RISK_INDICATOR: 'orange',

    // Web Audio API checks
    SPEECH_IN_WRITE_MODE: 'yellow',
    LIPS_MOVING_NO_AUDIO: 'yellow',
    TWO_SPEAKER_HEURISTIC: 'orange'
  }
};

/**
 * Base point deductions per severity level for integrity score calculation
 */
export const SEVERITY_BASE_DEDUCTIONS = {
  yellow: 3,
  orange: 10,
  red: 25
};

/**
 * Event-specific base deductions (overrides default severity base when specified)
 */
export const EVENT_BASE_DEDUCTIONS = {
  TAB_SWITCH: 3,
  WINDOW_BLUR: 3,
  RIGHT_CLICK: 2,
  CLIPBOARD_ACTION: 3,
  SPEECH_IN_WRITE_MODE: 4,
  LIPS_MOVING_NO_AUDIO: 4,
  FULLSCREEN_EXIT: 8,
  MULTIPLE_FACES: 10,
  PROHIBITED_OBJECT: 10,
  DEVTOOLS_SHORTCUT: 12,
  WINDOW_RESIZE_EXTRA_MONITOR: 8,
  VIRTUAL_CAMERA: 15,
  TYPING_ANOMALY_LARGE_PASTE: 10,
  TYPING_ANOMALY_UNIFORM_KEYSTROKES: 12,
  IMPLAUSIBLY_FAST_ANSWER: 12,
  AI_TEXT_RISK_INDICATOR: 10,
  TWO_SPEAKER_HEURISTIC: 12,
  IDENTITY_MISMATCH: 35
};

/**
 * Computes a time-decayed integrity score (0-100) per session and assigns integrityStatus.
 * Recent events carry full weight; older infractions decay smoothly based on configurable half-life.
 *
 * Status thresholds:
 * - GREEN: score >= 85 and no RED infractions
 * - YELLOW: 70 <= score < 85 and no RED infractions
 * - ORANGE: 50 <= score < 70 and no RED infractions
 * - RED: score < 50 or any escalated RED infraction
 *
 * @param {Array<Object>} events - Array of proctoring events
 * @param {Date|string|number} [currentTime=new Date()] - Reference time for decay calculation
 * @param {Object} [configs=proctorConfigs] - Proctoring configurations
 * @returns {{ integrityScore: number, integrityStatus: 'GREEN'|'YELLOW'|'ORANGE'|'RED', totalDeductions: number, hasRedInfraction: boolean }}
 */
export function calculateTimeDecayedIntegrityScore(events = [], currentTime = new Date(), configs = proctorConfigs) {
  const refTime = new Date(currentTime).getTime();
  const halfLifeMs = (configs.thresholds.timeDecay?.halfLifeMinutes || 15) * 60 * 1000;
  const decayConstant = Math.LN2 / halfLifeMs;

  let totalDecayedDeductions = 0;
  let hasRedInfraction = false;

  for (const ev of events) {
    const sev = ev.severity || 'yellow';
    if (sev === 'red') {
      hasRedInfraction = true;
    }

    const typeKey = (ev.type || '').toUpperCase();
    const baseDeduction = EVENT_BASE_DEDUCTIONS[typeKey] ?? SEVERITY_BASE_DEDUCTIONS[sev] ?? 3;

    const eventTime = ev.timestamp ? new Date(ev.timestamp).getTime() : refTime;
    const elapsedMs = Math.max(0, refTime - eventTime);

    // Exponential time decay: w = exp(-lambda * elapsed)
    const decayWeight = Math.exp(-decayConstant * elapsedMs);
    totalDecayedDeductions += baseDeduction * decayWeight;
  }

  const rawScore = (configs.thresholds.timeDecay?.initialScore || 100) - totalDecayedDeductions;
  const integrityScore = Math.max(0, Math.min(100, Math.round(rawScore)));

  let integrityStatus = 'GREEN';
  if (hasRedInfraction || integrityScore < 50) {
    integrityStatus = 'RED';
  } else if (integrityScore < 70) {
    integrityStatus = 'ORANGE';
  } else if (integrityScore < 85) {
    integrityStatus = 'YELLOW';
  } else {
    integrityStatus = 'GREEN';
  }

  return {
    integrityScore,
    integrityStatus,
    totalDeductions: Number(totalDecayedDeductions.toFixed(2)),
    hasRedInfraction
  };
}

/**
 * Proctoring Escalation Engine
 * Determines final event severity taking into account incident history and escalation rules.
 * Spec rule: 3 oranges become a red; 3 yellows become an orange.
 *
 * @param {Array<Object>} eventHistory - Past events in the session
 * @param {Object} currentEvent - The incoming proctoring event
 * @param {Object} [configs=proctorConfigs] - Configurable proctoring thresholds
 * @returns {Object} Escalation evaluation result { finalSeverity, isEscalated, orangeCount, yellowCount, redCount }
 */
export function evaluateSeverityAndEscalation(eventHistory = [], currentEvent = {}, configs = proctorConfigs) {
  const { escalation, baseSeverityMap } = configs;
  const eventType = currentEvent.type || 'LOOKING_AWAY';
  let initialSeverity = currentEvent.severity || baseSeverityMap[eventType] || 'yellow';

  // Specific duration-based severity adjustments
  if (eventType === 'LOOKING_AWAY' && (currentEvent.durationMs || 0) >= configs.thresholds.durations.lookingAwayOrangeMs) {
    initialSeverity = 'orange';
  }
  if (eventType === 'NO_FACE' && (currentEvent.durationMs || 0) >= configs.thresholds.durations.noFaceOrangeMs) {
    initialSeverity = 'orange';
  }

  // Count past active infractions
  const pastYellows = eventHistory.filter((e) => e.severity === 'yellow').length;
  const pastOranges = eventHistory.filter((e) => e.severity === 'orange').length;
  const pastReds = eventHistory.filter((e) => e.severity === 'red').length;

  let finalSeverity = initialSeverity;
  let isEscalated = false;
  let escalationReason = null;

  // 1. Check if yellow escalates to orange (every 3 yellows become orange)
  if (initialSeverity === 'yellow') {
    const totalYellows = pastYellows + 1;
    if (totalYellows >= escalation.yellowsToOrange && totalYellows % escalation.yellowsToOrange === 0) {
      finalSeverity = 'orange';
      isEscalated = true;
      escalationReason = `${escalation.yellowsToOrange} yellow warnings escalated to ORANGE`;
    }
  }

  // 2. Check if orange escalates to red (3 oranges become a red)
  if (finalSeverity === 'orange') {
    const effectiveOranges = pastOranges + 1;
    if (effectiveOranges >= escalation.orangesToRed) {
      finalSeverity = 'red';
      isEscalated = true;
      escalationReason = `${effectiveOranges} orange infractions escalated to RED`;
    }
  }

  // If already red, it stays red
  if (initialSeverity === 'red') {
    finalSeverity = 'red';
  }

  return {
    eventType,
    initialSeverity,
    finalSeverity,
    isEscalated,
    escalationReason,
    counts: {
      yellow: pastYellows + (finalSeverity === 'yellow' ? 1 : 0),
      orange: pastOranges + (finalSeverity === 'orange' ? 1 : 0),
      red: pastReds + (finalSeverity === 'red' ? 1 : 0)
    }
  };
}

export default proctorConfigs;
