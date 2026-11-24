import { describe, test, expect, beforeEach } from 'vitest';

// Emulate worker message loop with its rule logic
describe('Proctor Web Worker Rule Logic Unit Tests', () => {
  let state = {
    noFaceStartTime: null,
    lookingAwayStartTime: null,
    writeSpeechStartTime: null,
    eventHistory: []
  };

  const THRESHOLDS = {
    maxYawDeg: 25,
    maxPitchDeg: 20,
    maxIrisOffset: 0.25,
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

  beforeEach(() => {
    state = {
      noFaceStartTime: null,
      lookingAwayStartTime: null,
      writeSpeechStartTime: null,
      eventHistory: []
    };
  });

  function applyEscalation(event) {
    const initialSeverity = event.severity || 'yellow';
    const pastYellows = state.eventHistory.filter((e) => e.severity === 'yellow').length;
    const pastOranges = state.eventHistory.filter((e) => e.severity === 'orange').length;

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

    const result = {
      ...event,
      initialSeverity,
      severity: finalSeverity,
      isEscalated,
      escalationReason
    };
    state.eventHistory.push(result);
    return result;
  }

  function evaluateFrameRules(payload) {
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
    } = payload;

    const events = [];

    // 1. Multiple Faces -> RED per spec
    if (faceCount > 1) {
      events.push(
        applyEscalation({
          type: 'MULTIPLE_FACES',
          severity: 'red',
          confidence: 0.98,
          metadata: { faceCount }
        })
      );
    }

    // 2. Face Presence -> yellow -> orange -> red
    if (faceCount === 0) {
      if (!state.noFaceStartTime) {
        state.noFaceStartTime = timestamp;
      }
      const dur = timestamp - state.noFaceStartTime;
      if (dur >= THRESHOLDS.durations.noFaceYellowMs) {
        let severity = 'yellow';
        if (dur >= THRESHOLDS.durations.noFaceRedMs) {
          severity = 'red';
        } else if (dur >= THRESHOLDS.durations.noFaceOrangeMs) {
          severity = 'orange';
        }

        events.push(
          applyEscalation({
            type: 'NO_FACE',
            severity,
            durationMs: dur
          })
        );
      }
    } else {
      state.noFaceStartTime = null;
    }

    // 3. Head Pose & Iris Gaze Looking Away -> yellow -> orange
    const hasPoseDeviation =
      isLookingAway ||
      Math.abs(yaw) > THRESHOLDS.maxYawDeg ||
      Math.abs(pitch) > THRESHOLDS.maxPitchDeg ||
      irisOffset > THRESHOLDS.maxIrisOffset;

    if (faceCount === 1 && hasPoseDeviation) {
      if (!state.lookingAwayStartTime) {
        state.lookingAwayStartTime = timestamp;
      }
      const dur = timestamp - state.lookingAwayStartTime;
      if (dur >= THRESHOLDS.durations.lookingAwayYellowMs) {
        const severity = dur >= THRESHOLDS.durations.lookingAwayOrangeMs ? 'orange' : 'yellow';
        events.push(
          applyEscalation({
            type: 'LOOKING_AWAY',
            severity,
            durationMs: dur,
            metadata: { yaw, pitch, irisOffset }
          })
        );
      }
    } else if (faceCount >= 1 && !hasPoseDeviation) {
      state.lookingAwayStartTime = null;
    }

    // 4. Prohibited Objects -> RED per spec
    if (objects && objects.length > 0) {
      events.push(
        applyEscalation({
          type: 'PROHIBITED_OBJECT',
          severity: 'red',
          confidence: objects[0].score || 0.9,
          metadata: { detectedObjects: objects }
        })
      );
    }

    // 5. Identity Mismatch -> RED per spec
    if (identityResult && identityResult.faceFound && !identityResult.isMatch) {
      events.push(
        applyEscalation({
          type: 'IDENTITY_MISMATCH',
          severity: 'red',
          confidence: 0.95,
          metadata: { distance: identityResult.distance }
        })
      );
    }

    return events;
  }

  test('MULTIPLE_FACES immediately triggers a RED event per spec', () => {
    const events = evaluateFrameRules({ faceCount: 2 });
    expect(events.length).toBe(1);
    expect(events[0].type).toBe('MULTIPLE_FACES');
    expect(events[0].severity).toBe('red');
  });

  test('PROHIBITED_OBJECT (cell phone) immediately triggers a RED event per spec', () => {
    const events = evaluateFrameRules({
      faceCount: 1,
      objects: [{ class: 'cell phone', score: 0.92 }]
    });
    expect(events.length).toBe(1);
    expect(events[0].type).toBe('PROHIBITED_OBJECT');
    expect(events[0].severity).toBe('red');
  });

  test('IDENTITY_MISMATCH immediately triggers a RED event per spec', () => {
    const events = evaluateFrameRules({
      faceCount: 1,
      identityResult: { faceFound: true, isMatch: false, distance: 0.74 }
    });
    expect(events.length).toBe(1);
    expect(events[0].type).toBe('IDENTITY_MISMATCH');
    expect(events[0].severity).toBe('red');
  });

  test('NO_FACE escalates: no event (<1.2s) -> yellow (1.5s) -> orange (3.5s) -> red (6.5s)', () => {
    const t0 = 10000;
    // < 1200ms
    expect(evaluateFrameRules({ faceCount: 0, timestamp: t0 }).length).toBe(0);

    // 1500ms elapsed -> yellow
    const yellowEvs = evaluateFrameRules({ faceCount: 0, timestamp: t0 + 1500 });
    expect(yellowEvs.length).toBe(1);
    expect(yellowEvs[0].type).toBe('NO_FACE');
    expect(yellowEvs[0].severity).toBe('yellow');

    // 3500ms elapsed -> orange
    const orangeEvs = evaluateFrameRules({ faceCount: 0, timestamp: t0 + 3500 });
    expect(orangeEvs.length).toBe(1);
    expect(orangeEvs[0].severity).toBe('orange');

    // 6500ms elapsed -> red
    const redEvs = evaluateFrameRules({ faceCount: 0, timestamp: t0 + 6500 });
    expect(redEvs.length).toBe(1);
    expect(redEvs[0].severity).toBe('red');
  });

  test('LOOKING_AWAY escalates: yellow (2s) -> orange (4s)', () => {
    const t0 = 20000;
    // Initial start
    evaluateFrameRules({ faceCount: 1, yaw: 35, timestamp: t0 });

    // 2s elapsed -> yellow
    const yellowEvs = evaluateFrameRules({ faceCount: 1, yaw: 35, timestamp: t0 + 2000 });
    expect(yellowEvs.length).toBe(1);
    expect(yellowEvs[0].type).toBe('LOOKING_AWAY');
    expect(yellowEvs[0].severity).toBe('yellow');

    // 4s elapsed -> orange
    const orangeEvs = evaluateFrameRules({ faceCount: 1, yaw: 35, timestamp: t0 + 4000 });
    expect(orangeEvs.length).toBe(1);
    expect(orangeEvs[0].severity).toBe('orange');
  });

  test('multi-strike escalation: 3 yellow infractions become orange, 3 oranges become red', () => {
    // 3 separate yellow infractions
    const ev1 = applyEscalation({ type: 'SPEECH_IN_WRITE_MODE', severity: 'yellow' });
    expect(ev1.severity).toBe('yellow');

    const ev2 = applyEscalation({ type: 'SPEECH_IN_WRITE_MODE', severity: 'yellow' });
    expect(ev2.severity).toBe('yellow');

    // 3rd yellow escalates to ORANGE
    const ev3 = applyEscalation({ type: 'SPEECH_IN_WRITE_MODE', severity: 'yellow' });
    expect(ev3.severity).toBe('orange');
    expect(ev3.isEscalated).toBe(true);

    // 2nd orange
    const ev4 = applyEscalation({ type: 'LOOKING_AWAY', severity: 'orange' });
    expect(ev4.severity).toBe('orange');

    // 3rd orange escalates to RED!
    const ev5 = applyEscalation({ type: 'CAMERA_BLOCKED_DARK', severity: 'orange' });
    expect(ev5.severity).toBe('red');
    expect(ev5.isEscalated).toBe(true);
    expect(ev5.escalationReason).toContain('3 orange infractions escalated to RED');
  });
});
