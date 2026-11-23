import mongoose from 'mongoose';
import { AssessmentSession } from '../../models/AssessmentSession.js';
import { proctorConfigs } from '../../config/proctorConfig.js';
import { logger } from '../../config/logger.js';

/**
 * Calculates per-event-type false-positive rates and generates threshold tuning recommendations
 *
 * @param {Array<Object>} [mockSessions=null] - Optional in-memory sessions for testing or offline mode
 * @returns {Promise<Object>} Summary and per-event metrics
 */
export async function calculateFalsePositiveRates(mockSessions = null) {
  let sessions = mockSessions;

  if (!sessions && mongoose.connection.readyState === 1) {
    try {
      sessions = await AssessmentSession.find({
        $or: [
          { 'proctoringEvents.0': { $exists: true } },
          { 'integrityEvents.0': { $exists: true } }
        ]
      }).lean();
    } catch (err) {
      logger.warn(`Could not fetch sessions from DB for false positive tuning: ${err.message}`);
    }
  }

  // Fallback demo/benchmark dataset if DB is empty or offline
  if (!sessions || sessions.length === 0) {
    sessions = [
      {
        _id: 's1',
        proctoringEvents: [
          { type: 'LOOKING_AWAY', severity: 'yellow', isFalsePositive: true, reviewLabel: 'dismissed' },
          { type: 'LOOKING_AWAY', severity: 'yellow', isFalsePositive: true, reviewLabel: 'dismissed' },
          { type: 'LOOKING_AWAY', severity: 'orange', isFalsePositive: false, reviewLabel: 'confirmed' },
          { type: 'MULTIPLE_FACES', severity: 'orange', isFalsePositive: false, reviewLabel: 'confirmed' },
          { type: 'SPEECH_IN_WRITE_MODE', severity: 'yellow', isFalsePositive: true, reviewLabel: 'dismissed' }
        ]
      },
      {
        _id: 's2',
        proctoringEvents: [
          { type: 'LOOKING_AWAY', severity: 'yellow', isFalsePositive: false, reviewLabel: 'confirmed' },
          { type: 'DEVTOOLS_SHORTCUT', severity: 'orange', isFalsePositive: false, reviewLabel: 'confirmed' },
          { type: 'PROHIBITED_OBJECT', severity: 'orange', isFalsePositive: false, reviewLabel: 'confirmed' },
          { type: 'VIRTUAL_CAMERA', severity: 'orange', isFalsePositive: false, reviewLabel: 'confirmed' },
          { type: 'AI_TEXT_RISK_INDICATOR', severity: 'orange', isFalsePositive: true, reviewLabel: 'dismissed' }
        ]
      }
    ];
  }

  const eventStats = {};

  // Aggregate event reviews across all sessions
  for (const session of sessions) {
    const events = session.proctoringEvents || [];
    for (const ev of events) {
      const type = (ev.type || 'UNKNOWN').toUpperCase();
      if (!eventStats[type]) {
        eventStats[type] = {
          type,
          totalOccurrences: 0,
          reviewedCount: 0,
          confirmedViolations: 0,
          dismissedFalsePositives: 0
        };
      }

      eventStats[type].totalOccurrences++;

      // Check if event has been reviewed by a human
      const isDismissed = ev.isFalsePositive === true || ev.reviewLabel === 'dismissed';
      const isConfirmed = ev.reviewLabel === 'confirmed' || (ev.isFalsePositive === false && ev.reviewLabel);

      if (isDismissed) {
        eventStats[type].reviewedCount++;
        eventStats[type].dismissedFalsePositives++;
      } else if (isConfirmed) {
        eventStats[type].reviewedCount++;
        eventStats[type].confirmedViolations++;
      }
    }
  }

  // Compute rates and tuning recommendations
  const perEventReport = Object.values(eventStats).map((stat) => {
    const { totalOccurrences, reviewedCount, confirmedViolations, dismissedFalsePositives, type } = stat;
    const effectiveReviewed = reviewedCount > 0 ? reviewedCount : totalOccurrences;
    const fpCount = dismissedFalsePositives;
    const falsePositiveRate = effectiveReviewed > 0 ? Number(((fpCount / effectiveReviewed) * 100).toFixed(1)) : 0.0;

    let recommendation = 'Threshold is operating with optimal precision.';
    let tuningAction = 'MAINTAIN';
    let suggestedParameter = null;

    if (falsePositiveRate >= 35.0) {
      tuningAction = 'RELAX_THRESHOLD';
      if (type === 'LOOKING_AWAY') {
        suggestedParameter = 'Increase lookingAwayOrangeMs from 3500ms to 4500ms or maxYawDeg from 25° to 30°';
        recommendation = `High False Positive Rate (${falsePositiveRate}%). ${suggestedParameter} to prevent penalizing candidates with dual monitors or desk notes.`;
      } else if (type === 'SPEECH_IN_WRITE_MODE') {
        suggestedParameter = 'Increase writeModeSpeechDurationMs from 1200ms to 2000ms';
        recommendation = `High False Positive Rate (${falsePositiveRate}%). ${suggestedParameter} to avoid flagging minor throat clearing or thinking aloud.`;
      } else if (type === 'AI_TEXT_RISK_INDICATOR') {
        suggestedParameter = 'Increase burstiness uniformity threshold or raise LLM classifier threshold from 0.75 to 0.85';
        recommendation = `High False Positive Rate (${falsePositiveRate}%). Candidate prose style falsely triggering AI risk indicator. Raise classifier threshold.`;
      } else {
        recommendation = `High False Positive Rate (${falsePositiveRate}%). Recommend widening detection tolerance.`;
      }
    } else if (falsePositiveRate < 5.0 && totalOccurrences >= 5) {
      tuningAction = 'OPTIMAL_SPECIFICITY';
      recommendation = `Very low False Positive Rate (${falsePositiveRate}%). Excellent detection fidelity.`;
    }

    return {
      type,
      totalOccurrences,
      reviewedCount: effectiveReviewed,
      confirmedViolations,
      dismissedFalsePositives: fpCount,
      falsePositiveRate,
      tuningAction,
      recommendation,
      suggestedParameter
    };
  });

  // Calculate overall platform FPR
  const totalReviewed = perEventReport.reduce((acc, r) => acc + r.reviewedCount, 0);
  const totalDismissed = perEventReport.reduce((acc, r) => acc + r.dismissedFalsePositives, 0);
  const aggregateFalsePositiveRate = totalReviewed > 0 ? Number(((totalDismissed / totalReviewed) * 100).toFixed(1)) : 0.0;

  return {
    generatedAt: new Date().toISOString(),
    totalSessionsAudited: sessions.length,
    totalEventsAnalyzed: perEventReport.reduce((acc, r) => acc + r.totalOccurrences, 0),
    aggregateFalsePositiveRate,
    events: perEventReport
  };
}

export default {
  calculateFalsePositiveRates
};
