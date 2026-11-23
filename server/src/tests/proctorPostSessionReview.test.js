import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { calculateFalsePositiveRates } from '../services/proctor/tuningReport.js';
import {
  getProctoringFairnessMetrics,
  setAccessibilityOverride
} from '../services/fairness/proctorFairnessMetrics.js';
import { getProctoringKnownLimitations } from '../controllers/proctorController.js';

describe('Post-Session Review, False-Positive Tuning & Fairness Telemetry Suite', () => {
  describe('False-Positive Rate Calculation & Threshold Tuning Guidance', () => {
    it('accurately computes false positive rates per event type', async () => {
      const report = await calculateFalsePositiveRates();

      expect(report).toBeDefined();
      expect(Array.isArray(report.events)).toBe(true);
      expect(report.events.length).toBeGreaterThan(0);

      // Verify structure of metrics
      const lookingAway = report.events.find((m) => m.type === 'LOOKING_AWAY');
      expect(lookingAway).toBeDefined();
      expect(typeof lookingAway.totalOccurrences).toBe('number');
      expect(typeof lookingAway.reviewedCount).toBe('number');
      expect(typeof lookingAway.confirmedViolations).toBe('number');
      expect(typeof lookingAway.dismissedFalsePositives).toBe('number');
      expect(typeof lookingAway.falsePositiveRate).toBe('number');

      // Math verification: FPR = (dismissed / reviewed) * 100
      if (lookingAway.reviewedCount > 0) {
        const expectedFpr = Number(
          ((lookingAway.dismissedFalsePositives / lookingAway.reviewedCount) * 100).toFixed(1)
        );
        expect(lookingAway.falsePositiveRate).toBe(expectedFpr);
      }
    });

    it('generates threshold tuning recommendations for elevated false positive rates', async () => {
      const report = await calculateFalsePositiveRates();

      const elevatedEvent = report.events.find((e) => e.falsePositiveRate >= 35.0);
      expect(elevatedEvent).toBeDefined();
      expect(elevatedEvent.tuningAction).toBe('RELAX_THRESHOLD');
      expect(elevatedEvent.recommendation).toBeDefined();
      expect(elevatedEvent.suggestedParameter).toBeDefined();
    });

    it('includes aggregated overview totals and health status', async () => {
      const report = await calculateFalsePositiveRates();

      expect(report.totalSessionsAudited).toBeGreaterThan(0);
      expect(report.totalEventsAnalyzed).toBeGreaterThan(0);
      expect(typeof report.aggregateFalsePositiveRate).toBe('number');
      expect(report.aggregateFalsePositiveRate).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Extended Proctoring Fairness Metrics', () => {
    it('returns demographic group flag rates compliant with Four-Fifths 80% Rule', async () => {
      const fairness = await getProctoringFairnessMetrics();

      expect(fairness).toBeDefined();
      expect(fairness.groupFlagRates).toBeDefined();
      expect(fairness.groupFlagRates.gender).toBeDefined();
      expect(fairness.groupFlagRates.ethnicity).toBeDefined();
      expect(fairness.groupFlagRates.neurodiversity).toBeDefined();

      // Check gender cohorts
      const female = fairness.groupFlagRates.gender.find((g) => g.group === 'Female');
      const male = fairness.groupFlagRates.gender.find((g) => g.group === 'Male');
      expect(female).toBeDefined();
      expect(male).toBeDefined();
      expect(female.selectionRateRatio).toBeGreaterThanOrEqual(0.8); // 80% Rule
      expect(female.violates80Rule).toBe(false);
      expect(male.violates80Rule).toBe(false);
    });

    it('returns face-detection failure rates across ambient brightness (lux) buckets', async () => {
      const fairness = await getProctoringFairnessMetrics();

      expect(Array.isArray(fairness.faceDetectionVsBrightness)).toBe(true);
      expect(fairness.faceDetectionVsBrightness.length).toBe(4);

      const darkBucket = fairness.faceDetectionVsBrightness.find((b) =>
        b.luminanceBucket.includes('< 50 lux')
      );
      const optimalBucket = fairness.faceDetectionVsBrightness.find((b) =>
        b.luminanceBucket.includes('120 - 200 lux')
      );

      expect(darkBucket).toBeDefined();
      expect(darkBucket.isElevatedRisk).toBe(true);
      expect(darkBucket.failureRate).toBeGreaterThan(10); // Elevated in dark
      expect(optimalBucket).toBeDefined();
      expect(optimalBucket.isElevatedRisk).toBe(false);
      expect(optimalBucket.failureRate).toBeLessThan(5); // Low in optimal
    });

    it('verifies content score parity between voice-mode and text-mode', async () => {
      const fairness = await getProctoringFairnessMetrics();

      expect(fairness.inputModeScoringParity).toBeDefined();
      const parity = fairness.inputModeScoringParity;

      expect(parity.modes.length).toBe(3); // type, speak, hybrid
      expect(parity.isParityCompliant).toBe(true);
      expect(parity.scoreDeltaVoiceVsText).toBeLessThan(3.0); // Variance < 3%
      expect(parity.parityVerdict).toContain('semantic concepts identically');
    });
  });

  describe('Accessibility Accommodations & Overrides', () => {
    it('configures relaxed proctoring tolerances for candidates with documented needs', async () => {
      const accommodation = await setAccessibilityOverride({
        candidateId: 'test_cand_neuro_001',
        sessionId: 'test_session_001',
        documentedNeed: 'ADHD / Gaze Focus Accommodation',
        relaxedConfigs: {
          headPoseToleranceRatio: 2.2,
          lookingAwayAllowed: true,
          speechInWriteModeAllowed: true,
          extraTimerPercentage: 50,
          disableFillerWordDeductions: true
        },
        adminUser: { id: 'admin_1', email: 'compliance@adaptiq.ai' }
      });

      expect(accommodation).toBeDefined();
      expect(accommodation.isEnabled).toBe(true);
      expect(accommodation.documentedNeed).toBe('ADHD / Gaze Focus Accommodation');
      expect(accommodation.grantedBy).toBe('compliance@adaptiq.ai');
      expect(accommodation.relaxedConfigs.headPoseToleranceRatio).toBe(2.2);
      expect(accommodation.relaxedConfigs.lookingAwayAllowed).toBe(true);
      expect(accommodation.relaxedConfigs.speechInWriteModeAllowed).toBe(true);
      expect(accommodation.relaxedConfigs.extraTimerPercentage).toBe(50);
      expect(accommodation.relaxedConfigs.disableFillerWordDeductions).toBe(true);
    });
  });

  describe('Proctoring Known Limitations & Legal Disclaimers', () => {
    it('returns the 5 canonical limitations compliant with EU AI Act and EEOC guidance', () => {
      const limitations = getProctoringKnownLimitations();

      expect(Array.isArray(limitations)).toBe(true);
      expect(limitations.length).toBe(5);

      const titles = limitations.map((l) => l.title);
      expect(titles).toContain('Ambient Lighting & Optical Variability');
      expect(titles).toContain('Eyewear, Astigmatism & Multi-Monitor Setups');
      expect(titles).toContain('Acoustic Environment & Verbal Pacing');
      expect(titles).toContain('AI Text Risk Indicator is Probabilistic');
      expect(titles).toContain('Mandatory Human-in-the-Loop Governance');

      // Validate EU AI Act & EEOC compliance requirement in text
      const governanceLimitation = limitations.find(
        (l) => l.title === 'Mandatory Human-in-the-Loop Governance'
      );
      expect(governanceLimitation.description).toContain('EEOC');
      expect(governanceLimitation.description).toContain('EU AI Act');
      expect(governanceLimitation.description).toContain('human recruiter confirmation');
    });
  });
});
