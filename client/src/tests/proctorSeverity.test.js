import { describe, test, expect } from 'vitest';
import {
  evaluateSeverityAndEscalation,
  proctorConfigs,
  calculateTimeDecayedIntegrityScore
} from '../config/proctorConfig.js';

describe('AI Proctoring Severity and Escalation Logic (Vitest)', () => {
  test('assigns base severities according to specification', () => {
    const lookingAway = evaluateSeverityAndEscalation([], { type: 'LOOKING_AWAY' });
    expect(lookingAway.finalSeverity).toBe('yellow');
    expect(lookingAway.isEscalated).toBe(false);

    const multipleFaces = evaluateSeverityAndEscalation([], { type: 'MULTIPLE_FACES' });
    expect(multipleFaces.finalSeverity).toBe('orange');

    const prohibitedObject = evaluateSeverityAndEscalation([], { type: 'PROHIBITED_OBJECT' });
    expect(prohibitedObject.finalSeverity).toBe('orange');

    const identityMismatch = evaluateSeverityAndEscalation([], { type: 'IDENTITY_MISMATCH' });
    expect(identityMismatch.finalSeverity).toBe('red');
  });

  test('assigns base severities for browser, typing, audio, and AI-risk events', () => {
    // Browser behaviour
    expect(evaluateSeverityAndEscalation([], { type: 'TAB_SWITCH' }).finalSeverity).toBe('yellow');
    expect(evaluateSeverityAndEscalation([], { type: 'WINDOW_BLUR' }).finalSeverity).toBe('yellow');
    expect(evaluateSeverityAndEscalation([], { type: 'RIGHT_CLICK' }).finalSeverity).toBe('yellow');
    expect(evaluateSeverityAndEscalation([], { type: 'DEVTOOLS_SHORTCUT' }).finalSeverity).toBe('orange');
    expect(evaluateSeverityAndEscalation([], { type: 'WINDOW_RESIZE_EXTRA_MONITOR' }).finalSeverity).toBe('orange');
    expect(evaluateSeverityAndEscalation([], { type: 'VIRTUAL_CAMERA' }).finalSeverity).toBe('orange');

    // Typing anomalies
    expect(evaluateSeverityAndEscalation([], { type: 'TYPING_ANOMALY_LARGE_PASTE' }).finalSeverity).toBe('orange');
    expect(evaluateSeverityAndEscalation([], { type: 'TYPING_ANOMALY_UNIFORM_KEYSTROKES' }).finalSeverity).toBe('orange');
    expect(evaluateSeverityAndEscalation([], { type: 'IMPLAUSIBLY_FAST_ANSWER' }).finalSeverity).toBe('orange');

    // AI-generated text risk indicator
    expect(evaluateSeverityAndEscalation([], { type: 'AI_TEXT_RISK_INDICATOR' }).finalSeverity).toBe('orange');

    // Audio checks
    expect(evaluateSeverityAndEscalation([], { type: 'SPEECH_IN_WRITE_MODE' }).finalSeverity).toBe('yellow');
    expect(evaluateSeverityAndEscalation([], { type: 'LIPS_MOVING_NO_AUDIO' }).finalSeverity).toBe('yellow');
    expect(evaluateSeverityAndEscalation([], { type: 'TWO_SPEAKER_HEURISTIC' }).finalSeverity).toBe('orange');
  });

  test('escalates prolonged looking away from yellow to orange', () => {
    const prolonged = evaluateSeverityAndEscalation([], {
      type: 'LOOKING_AWAY',
      durationMs: 4000
    });
    expect(prolonged.finalSeverity).toBe('orange');
  });

  test('escalates 3 yellow infractions into an orange infraction', () => {
    const history = [
      { type: 'TAB_SWITCH', severity: 'yellow' },
      { type: 'WINDOW_BLUR', severity: 'yellow' }
    ];

    const thirdYellow = evaluateSeverityAndEscalation(history, { type: 'RIGHT_CLICK' });
    expect(thirdYellow.finalSeverity).toBe('orange');
    expect(thirdYellow.isEscalated).toBe(true);
    expect(thirdYellow.escalationReason).toContain('3 yellow warnings escalated to ORANGE');
  });

  test('ESCALATION SPEC: exactly 3 oranges become a red across cross-domain events', () => {
    // 1st Orange Event: Devtools shortcut
    const firstOrange = evaluateSeverityAndEscalation([], { type: 'DEVTOOLS_SHORTCUT' });
    expect(firstOrange.finalSeverity).toBe('orange');
    expect(firstOrange.isEscalated).toBe(false);

    // 2nd Orange Event: Typing anomaly large paste
    const historyWith1Orange = [
      { type: 'DEVTOOLS_SHORTCUT', severity: 'orange' }
    ];
    const secondOrange = evaluateSeverityAndEscalation(historyWith1Orange, { type: 'TYPING_ANOMALY_LARGE_PASTE' });
    expect(secondOrange.finalSeverity).toBe('orange');
    expect(secondOrange.isEscalated).toBe(false);

    // 3rd Orange Event: Two-speaker heuristic -> MUST ESCALATE TO RED!
    const historyWith2Oranges = [
      { type: 'DEVTOOLS_SHORTCUT', severity: 'orange' },
      { type: 'TYPING_ANOMALY_LARGE_PASTE', severity: 'orange' }
    ];
    const thirdOrange = evaluateSeverityAndEscalation(historyWith2Oranges, { type: 'TWO_SPEAKER_HEURISTIC' });
    expect(thirdOrange.finalSeverity).toBe('red');
    expect(thirdOrange.isEscalated).toBe(true);
    expect(thirdOrange.escalationReason).toContain('3 orange infractions escalated to RED');
  });

  test('computes time-decayed integrity score and status correctly', () => {
    const now = Date.now();

    // Clean session: 100 and GREEN
    const cleanScore = calculateTimeDecayedIntegrityScore([], now);
    expect(cleanScore.integrityScore).toBe(100);
    expect(cleanScore.integrityStatus).toBe('GREEN');

    // Minor yellow events: 94 and GREEN
    const minorEvents = [
      { type: 'TAB_SWITCH', severity: 'yellow', timestamp: new Date(now).toISOString() },
      { type: 'RIGHT_CLICK', severity: 'yellow', timestamp: new Date(now).toISOString() }
    ];
    const minorScore = calculateTimeDecayedIntegrityScore(minorEvents, now);
    expect(minorScore.integrityScore).toBeGreaterThanOrEqual(90);
    expect(minorScore.integrityStatus).toBe('GREEN');

    // Orange event drops score into YELLOW/ORANGE range
    const moderateEvents = [
      { type: 'DEVTOOLS_SHORTCUT', severity: 'orange', timestamp: new Date(now).toISOString() },
      { type: 'TYPING_ANOMALY_LARGE_PASTE', severity: 'orange', timestamp: new Date(now).toISOString() }
    ];
    const moderateScore = calculateTimeDecayedIntegrityScore(moderateEvents, now);
    expect(moderateScore.integrityScore).toBeLessThan(85);
    expect(['YELLOW', 'ORANGE']).toContain(moderateScore.integrityStatus);

    // Any RED infraction guarantees RED status
    const criticalEvents = [
      { type: 'IDENTITY_MISMATCH', severity: 'red', timestamp: new Date(now).toISOString() }
    ];
    const criticalScore = calculateTimeDecayedIntegrityScore(criticalEvents, now);
    expect(criticalScore.integrityStatus).toBe('RED');

    // Time decay test: an infraction from 30 minutes ago decays by 75%
    const oldTimestamp = new Date(now - 30 * 60 * 1000).toISOString();
    const oldEvent = [{ type: 'FULLSCREEN_EXIT', severity: 'orange', timestamp: oldTimestamp }];
    const recentEvent = [{ type: 'FULLSCREEN_EXIT', severity: 'orange', timestamp: new Date(now).toISOString() }];

    const oldResult = calculateTimeDecayedIntegrityScore(oldEvent, now);
    const recentResult = calculateTimeDecayedIntegrityScore(recentEvent, now);

    expect(oldResult.integrityScore).toBeGreaterThan(recentResult.integrityScore);
  });

  test('supports configurable escalation thresholds from proctorConfigs', () => {
    const customConfig = {
      ...proctorConfigs,
      escalation: {
        yellowsToOrange: 2,
        orangesToRed: 2
      }
    };

    const historyWith1Orange = [
      { type: 'PROHIBITED_OBJECT', severity: 'orange' }
    ];

    const secondOrangeCustom = evaluateSeverityAndEscalation(
      historyWith1Orange,
      { type: 'CAMERA_BLOCKED_DARK' },
      customConfig
    );
    expect(secondOrangeCustom.finalSeverity).toBe('red');
    expect(secondOrangeCustom.isEscalated).toBe(true);
  });
});
