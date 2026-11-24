/**
 * @file proctor.worker.js
 * AI Proctoring Web Worker
 * Pure rule logic engine off the main thread:
 * - Tracks incident durations (no face, looking away, speech in write mode)
 * - Assigns base severities per specification:
 *     MULTIPLE_FACES: RED
 *     IDENTITY_MISMATCH: RED
 *     PROHIBITED_OBJECT: RED
 *     NO_FACE: YELLOW -> ORANGE -> RED
 *     LOOKING_AWAY: YELLOW -> ORANGE
 * - Enforces multi-strike escalation: 3 yellows become an orange; 3 oranges become a red
 */

const THRESHOLDS = {
  maxYawDeg: 25,
  maxPitchDeg: 20,
  maxIrisOffset: 0.25,
  maxEmbeddingDistance: 0.50,
  durations: {
    lookingAwayYellowMs: 1500,
    lookingAwayOrangeMs: 3500,
    noFaceYellowMs: 1200,
    noFaceOrangeMs: 3000,
    noFaceRedMs: 6000,
    writeSpeechMs: 1200
  },
  escalation: {
    yellowsToOrange: 3,
    orangesToRed: 3
  }
};

// Session state tracking
let noFaceStartTime = null;
let lookingAwayStartTime = null;
let writeSpeechStartTime = null;
let eventHistory = [];

/**
 * Evaluates event escalation based on incident history
 */
function applyEscalation(event) {
  const initialSeverity = event.severity || 'yellow';
  const pastYellows = eventHistory.filter((e) => e.severity === 'yellow').length;
  const pastOranges = eventHistory.filter((e) => e.severity === 'orange').length;

  let finalSeverity = initialSeverity;
  let isEscalated = false;
  let escalationReason = null;

  if (initialSeverity === 'yellow') {
    const totalYellows = pastYellows + 1;
    if (totalYellows >= THRESHOLDS.escalation.yellowsToOrange && totalYellows % THRESHOLDS.escalation.yellowsToOrange === 0) {
      finalSeverity = 'orange';
      isEscalated = true;
      escalationReason = `${THRESHOLDS.escalation.yellowsToOrange} yellow warnings escalated to ORANGE`;
    }
  }

  if (finalSeverity === 'orange') {
    const effectiveOranges = pastOranges + 1;
    if (effectiveOranges >= THRESHOLDS.escalation.orangesToRed) {
      finalSeverity = 'red';
      isEscalated = true;
      escalationReason = `${effectiveOranges} orange infractions escalated to RED`;
    }
  }

  if (initialSeverity === 'red') {
    finalSeverity = 'red';
  }

  const resultEvent = {
    ...event,
    initialSeverity,
    severity: finalSeverity,
    isEscalated,
    escalationReason
  };

  eventHistory.push(resultEvent);
  if (eventHistory.length > 100) {
    eventHistory.shift();
  }

  return resultEvent;
}

self.onmessage = function (e) {
  const { type, payload } = e.data || {};

  if (type === 'RESET') {
    noFaceStartTime = null;
    lookingAwayStartTime = null;
    writeSpeechStartTime = null;
    eventHistory = [];
    self.postMessage({ type: 'RESET_COMPLETE' });
    return;
  }

  if (type === 'ANALYZE_PROCTOR_DATA') {
    const {
      faceCount = 0,
      yaw = 0,
      pitch = 0,
      roll = 0,
      irisOffset = 0,
      isLookingAway = false,
      objects = [],
      identityResult = null,
      audioMetrics = {},
      timestamp = Date.now()
    } = payload || {};

    const detectedEvents = [];
    const isoTimestamp = new Date(timestamp).toISOString();

    // 1. Multiple Faces Check -> RED per spec
    if (faceCount > 1) {
      detectedEvents.push(
        applyEscalation({
          type: 'MULTIPLE_FACES',
          severity: 'red',
          confidence: 0.98,
          metadata: { faceCount },
          timestamp: isoTimestamp
        })
      );
    }

    // 2. Face Presence Check -> Yellow -> Orange -> Red
    if (faceCount === 0) {
      if (!noFaceStartTime) {
        noFaceStartTime = timestamp;
      }
      const durationMs = timestamp - noFaceStartTime;
      if (durationMs >= THRESHOLDS.durations.noFaceYellowMs) {
        let severity = 'yellow';
        if (durationMs >= THRESHOLDS.durations.noFaceRedMs) {
          severity = 'red';
        } else if (durationMs >= THRESHOLDS.durations.noFaceOrangeMs) {
          severity = 'orange';
        }

        detectedEvents.push(
          applyEscalation({
            type: 'NO_FACE',
            severity,
            durationMs,
            confidence: 0.95,
            metadata: { durationMs },
            timestamp: isoTimestamp
          })
        );
      }
    } else {
      noFaceStartTime = null;
    }

    // 3. Head Pose & Iris Gaze Looking Away -> Yellow -> Orange
    const hasPoseDeviation =
      isLookingAway ||
      Math.abs(yaw) > THRESHOLDS.maxYawDeg ||
      Math.abs(pitch) > THRESHOLDS.maxPitchDeg ||
      irisOffset > THRESHOLDS.maxIrisOffset;

    if (faceCount === 1 && hasPoseDeviation) {
      if (!lookingAwayStartTime) {
        lookingAwayStartTime = timestamp;
      }
      const durationMs = timestamp - lookingAwayStartTime;
      if (durationMs >= THRESHOLDS.durations.lookingAwayYellowMs) {
        const severity =
          durationMs >= THRESHOLDS.durations.lookingAwayOrangeMs ? 'orange' : 'yellow';

        detectedEvents.push(
          applyEscalation({
            type: 'LOOKING_AWAY',
            severity,
            durationMs,
            confidence: 0.90,
            metadata: { durationMs, yaw, pitch, roll, irisOffset },
            timestamp: isoTimestamp
          })
        );
      }
    } else if (faceCount >= 1 && !hasPoseDeviation) {
      lookingAwayStartTime = null;
    }

    // 4. Prohibited Objects (cell phone, book, laptop, tv) -> RED per spec
    if (objects && objects.length > 0) {
      detectedEvents.push(
        applyEscalation({
          type: 'PROHIBITED_OBJECT',
          severity: 'red',
          confidence: objects[0].score || 0.85,
          metadata: { detectedObjects: objects },
          timestamp: isoTimestamp
        })
      );
    }

    // 5. Biometric Identity Mismatch -> RED per spec
    if (identityResult && identityResult.faceFound && !identityResult.isMatch) {
      detectedEvents.push(
        applyEscalation({
          type: 'IDENTITY_MISMATCH',
          severity: 'red',
          confidence: Math.min(0.99, Number((0.7 + identityResult.distance * 0.3).toFixed(2))),
          metadata: {
            distance: identityResult.distance,
            threshold: identityResult.threshold
          },
          timestamp: isoTimestamp
        })
      );
    }

    // 6. Audio Checks
    if (audioMetrics.isWriteMode && audioMetrics.speechDetected) {
      if (!writeSpeechStartTime) {
        writeSpeechStartTime = timestamp;
      }
      if (timestamp - writeSpeechStartTime >= THRESHOLDS.durations.writeSpeechMs) {
        detectedEvents.push(
          applyEscalation({
            type: 'SPEECH_IN_WRITE_MODE',
            severity: 'yellow',
            confidence: 0.88,
            metadata: { volume: audioMetrics.volume, mode: 'write' },
            timestamp: isoTimestamp
          })
        );
      }
    } else {
      writeSpeechStartTime = null;
    }

    if ((audioMetrics.twoSpeakerVariance ?? 0) >= 0.35) {
      detectedEvents.push(
        applyEscalation({
          type: 'TWO_SPEAKER_HEURISTIC',
          severity: 'orange',
          confidence: 0.85,
          metadata: { formantVariance: audioMetrics.twoSpeakerVariance },
          timestamp: isoTimestamp
        })
      );
    }

    self.postMessage({
      type: 'PROCTOR_EVALUATION',
      detectedEvents,
      timestamp
    });
  }
};
