/**
 * @file proctor.worker.js
 * AI Proctoring Web Worker
 * Runs frame analysis every ~500ms off the main thread:
 * - Luminance & camera blocked/dark check
 * - Head pose (yaw/pitch) & iris gaze deviation
 * - Face count (no face, multiple faces)
 * - Biometric identity verification (128-d embedding Euclidean distance)
 * - Prohibited object heuristic detection (phone, book, laptop)
 */

// Proctoring thresholds
const THRESHOLDS = {
  minLuminance: 38,
  maxLuminance: 240,
  maxYawDeg: 25,
  maxPitchDeg: 20,
  maxIrisDeviation: 0.28,
  maxEmbeddingDistance: 0.42,
  durations: {
    lookingAwayYellowMs: 1500,
    lookingAwayOrangeMs: 3500,
    noFaceYellowMs: 1200,
    noFaceOrangeMs: 3000
  }
};

// Tracking durations for cumulative infractions
let noFaceStartTime = null;
let lookingAwayStartTime = null;
let lipMovementStartTime = null;
let writeSpeechStartTime = null;

/**
 * Calculates mouth aspect ratio (MAR) from lip landmarks
 * 13: upper lip, 14: lower lip, 61: left mouth corner, 291: right mouth corner
 */
function evaluateMouthMovement(landmarks) {
  if (!landmarks || landmarks.length === 0) return { isMoving: false, mar: 0 };
  const upperLip = landmarks[13] || { x: 0.5, y: 0.65 };
  const lowerLip = landmarks[14] || { x: 0.5, y: 0.68 };
  const leftCorner = landmarks[61] || { x: 0.42, y: 0.66 };
  const rightCorner = landmarks[291] || { x: 0.58, y: 0.66 };

  const height = Math.abs(lowerLip.y - upperLip.y);
  const width = Math.abs(rightCorner.x - leftCorner.x) || 0.16;
  const mar = height / width;

  return {
    isMoving: mar >= 0.22,
    mar: Number(mar.toFixed(3))
  };
}

/**
 * Calculates average perceptual luminance from ImageData buffer
 * L = 0.299R + 0.587G + 0.114B
 */
function calculateLuminance(data, step = 8) {
  if (!data || data.length === 0) return 128;
  let totalLuminance = 0;
  let sampleCount = 0;

  for (let i = 0; i < data.length; i += 4 * step) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const l = 0.299 * r + 0.587 * g + 0.114 * b;
    totalLuminance += l;
    sampleCount++;
  }

  return sampleCount > 0 ? totalLuminance / sampleCount : 128;
}

/**
 * Calculates Euclidean distance between two 128-dimensional face embedding vectors
 */
function calculateEmbeddingDistance(embA, embB) {
  if (!embA || !embB || embA.length !== embB.length) return 0;
  let sumSq = 0;
  for (let i = 0; i < embA.length; i++) {
    const diff = embA[i] - embB[i];
    sumSq += diff * diff;
  }
  return Math.sqrt(sumSq);
}

/**
 * Evaluates head pose (yaw/pitch) and iris gaze from facial landmarks
 */
function evaluateGazeAndPose(landmarks) {
  if (!landmarks || landmarks.length === 0) {
    return { isLookingAway: false, yaw: 0, pitch: 0, irisDeviation: 0 };
  }

  // Mediapipe / face-mesh canonical landmarks or simplified points:
  // 1: nose tip, 33: left eye outer, 263: right eye outer, 468: left iris, 473: right iris
  const nose = landmarks[1] || landmarks[0] || { x: 0.5, y: 0.5 };
  const leftEye = landmarks[33] || { x: 0.35, y: 0.4 };
  const rightEye = landmarks[263] || { x: 0.65, y: 0.4 };

  const eyeMidX = (leftEye.x + rightEye.x) / 2;
  const eyeMidY = (leftEye.y + rightEye.y) / 2;
  const eyeDistance = Math.abs(rightEye.x - leftEye.x) || 0.3;

  // Approximate Yaw: horizontal deviation of nose tip from eye midpoint
  const normalizedYawOffset = (nose.x - eyeMidX) / eyeDistance;
  const estimatedYawDeg = normalizedYawOffset * 55; // Approx scale to degrees

  // Approximate Pitch: vertical deviation of nose tip relative to eye-level
  const normalizedPitchOffset = (nose.y - eyeMidY) / eyeDistance - 0.55;
  const estimatedPitchDeg = normalizedPitchOffset * 50;

  // Iris Gaze deviation (if iris landmarks available)
  let irisGazeDeviation = 0;
  if (landmarks[468] && landmarks[473]) {
    const leftIris = landmarks[468];
    const rightIris = landmarks[473];
    const leftIrisDev = Math.abs(leftIris.x - eyeMidX);
    const rightIrisDev = Math.abs(rightIris.x - eyeMidX);
    irisGazeDeviation = (leftIrisDev + rightIrisDev) / 2;
  }

  const isLookingAway =
    Math.abs(estimatedYawDeg) > THRESHOLDS.maxYawDeg ||
    Math.abs(estimatedPitchDeg) > THRESHOLDS.maxPitchDeg ||
    irisGazeDeviation > THRESHOLDS.maxIrisDeviation;

  return {
    isLookingAway,
    yaw: Math.round(estimatedYawDeg),
    pitch: Math.round(estimatedPitchDeg),
    irisDeviation: Number(irisGazeDeviation.toFixed(3))
  };
}

// Worker message listener
self.onmessage = function (e) {
  const { type, payload } = e.data;

  if (type === 'RESET') {
    noFaceStartTime = null;
    lookingAwayStartTime = null;
    self.postMessage({ type: 'RESET_COMPLETE' });
    return;
  }

  if (type === 'ANALYZE_FRAME') {
    const {
      pixels,
      width = 640,
      height = 480,
      faces = [],
      objects = [],
      currentEmbedding = null,
      referenceEmbedding = null,
      now = Date.now()
    } = payload;

    const detectedEvents = [];

    // 1. Lighting / Camera Blocked Check
    if (pixels && pixels.length > 0) {
      const luminance = calculateLuminance(pixels);
      if (luminance < THRESHOLDS.minLuminance || luminance > THRESHOLDS.maxLuminance) {
        detectedEvents.push({
          type: 'CAMERA_BLOCKED_DARK',
          severity: 'orange',
          confidence: 0.92,
          metadata: { luminance: Math.round(luminance) },
          timestamp: new Date(now).toISOString()
        });
      }
    }

    // 2. Face Presence & Multiple Faces Check
    const faceCount = faces.length;
    if (faceCount === 0) {
      if (!noFaceStartTime) {
        noFaceStartTime = now;
      }
      const durationMs = now - noFaceStartTime;
      if (durationMs >= THRESHOLDS.durations.noFaceYellowMs) {
        const severity = durationMs >= THRESHOLDS.durations.noFaceOrangeMs ? 'orange' : 'yellow';
        detectedEvents.push({
          type: 'NO_FACE',
          severity,
          durationMs,
          confidence: 0.95,
          metadata: { durationMs },
          timestamp: new Date(now).toISOString()
        });
      }
    } else {
      noFaceStartTime = null;
    }

    if (faceCount > 1) {
      detectedEvents.push({
        type: 'MULTIPLE_FACES',
        severity: 'orange',
        confidence: 0.96,
        metadata: { faceCount },
        timestamp: new Date(now).toISOString()
      });
    }

    // 3. Head Pose & Gaze / Iris Looking Away
    if (faceCount === 1 && faces[0]?.landmarks) {
      const gazeEvaluation = evaluateGazeAndPose(faces[0].landmarks);
      if (gazeEvaluation.isLookingAway) {
        if (!lookingAwayStartTime) {
          lookingAwayStartTime = now;
        }
        const durationMs = now - lookingAwayStartTime;
        if (durationMs >= THRESHOLDS.durations.lookingAwayYellowMs) {
          const severity =
            durationMs >= THRESHOLDS.durations.lookingAwayOrangeMs ? 'orange' : 'yellow';
          detectedEvents.push({
            type: 'LOOKING_AWAY',
            severity,
            durationMs,
            confidence: 0.88,
            metadata: {
              durationMs,
              yaw: gazeEvaluation.yaw,
              pitch: gazeEvaluation.pitch,
              irisDeviation: gazeEvaluation.irisDeviation
            },
            timestamp: new Date(now).toISOString()
          });
        }
      } else {
        lookingAwayStartTime = null;
      }
    } else if (faceCount === 0) {
      lookingAwayStartTime = null;
    }

    // 4. Biometric Identity Verification
    if (currentEmbedding && referenceEmbedding && faceCount === 1) {
      const distance = calculateEmbeddingDistance(currentEmbedding, referenceEmbedding);
      if (distance > THRESHOLDS.maxEmbeddingDistance) {
        detectedEvents.push({
          type: 'IDENTITY_MISMATCH',
          severity: 'red',
          confidence: Math.min(0.99, Number((0.7 + distance * 0.3).toFixed(2))),
          metadata: {
            embeddingDistance: Number(distance.toFixed(4)),
            threshold: THRESHOLDS.maxEmbeddingDistance
          },
          timestamp: new Date(now).toISOString()
        });
      }
    }

    // 5. Prohibited Objects Detection (COCO-SSD / Model detections)
    if (objects && objects.length > 0) {
      const prohibitedLabels = ['cell phone', 'phone', 'book', 'laptop', 'tablet'];
      const foundProhibited = objects.filter((obj) => {
        const name = (obj.class || obj.label || '').toLowerCase();
        return prohibitedLabels.some((p) => name.includes(p)) && (obj.score || 0) >= 0.55;
      });

      if (foundProhibited.length > 0) {
        detectedEvents.push({
          type: 'PROHIBITED_OBJECT',
          severity: 'orange',
          confidence: foundProhibited[0].score || 0.85,
          metadata: {
            detectedObjects: foundProhibited.map((o) => ({
              class: o.class || o.label,
              score: o.score
            }))
          },
          timestamp: new Date(now).toISOString()
        });
      }
    }

    // 6. Audio Checks: Lips Moving with No Audio, Speech in Write Mode, Two-Speaker Heuristic
    const { audioMetrics = {} } = payload;
    const isSilent = (audioMetrics.volume ?? 0) <= 0.04;
    const isSpeech = Boolean(audioMetrics.speechDetected);

    // Check: Lips moving while audio is silent
    if (faceCount === 1 && faces[0]?.landmarks) {
      const mouth = evaluateMouthMovement(faces[0].landmarks);
      if (mouth.isMoving && isSilent) {
        if (!lipMovementStartTime) {
          lipMovementStartTime = now;
        }
        if (now - lipMovementStartTime >= 1200) {
          detectedEvents.push({
            type: 'LIPS_MOVING_NO_AUDIO',
            severity: 'yellow',
            confidence: 0.86,
            metadata: { mar: mouth.mar, durationMs: now - lipMovementStartTime },
            timestamp: new Date(now).toISOString()
          });
        }
      } else {
        lipMovementStartTime = null;
      }
    } else {
      lipMovementStartTime = null;
    }

    // Check: Speech detected while in write mode
    if (audioMetrics.isWriteMode && isSpeech) {
      if (!writeSpeechStartTime) {
        writeSpeechStartTime = now;
      }
      if (now - writeSpeechStartTime >= 1200) {
        detectedEvents.push({
          type: 'SPEECH_IN_WRITE_MODE',
          severity: 'yellow',
          confidence: 0.88,
          metadata: { volume: audioMetrics.volume, mode: 'write' },
          timestamp: new Date(now).toISOString()
        });
      }
    } else {
      writeSpeechStartTime = null;
    }

    // Check: Two-speaker formant heuristic
    if ((audioMetrics.twoSpeakerVariance ?? 0) >= 0.35) {
      detectedEvents.push({
        type: 'TWO_SPEAKER_HEURISTIC',
        severity: 'orange',
        confidence: 0.85,
        metadata: { formantVariance: audioMetrics.twoSpeakerVariance },
        timestamp: new Date(now).toISOString()
      });
    }

    // Send analysis result back to useProctor hook on main thread
    self.postMessage({
      type: 'PROCTOR_EVALUATION',
      detectedEvents,
      timestamp: now
    });
  }
};
