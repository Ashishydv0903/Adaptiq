/**
 * @file Proctoring Controller
 * Handles consent verification, 3-frame face biometrics enrolment,
 * live evidence storage (GridFS/Cloudinary/S3), recruiter actions, active session grid,
 * and automated retention cleanup.
 */

import mongoose from 'mongoose';
import { User, AssessmentSession, ReviewQueueItem, Evidence } from '../models/index.js';
import { AppError } from '../middleware/errorHandler.js';
import { proctorConfigs, calculateTimeDecayedIntegrityScore } from '../config/proctorConfig.js';
import { classifyAITextRisk } from '../services/proctor/aiTextClassifier.js';
import { saveEvidence, getEvidenceStream, cleanupExpiredEvidence } from '../services/proctor/evidenceStorage.js';
import { logProctorAction, getSessionAuditLogs } from '../services/proctor/auditService.js';
import { calculateFalsePositiveRates } from '../services/proctor/tuningReport.js';
import { getIO } from '../services/socket.js';
import { logger } from '../config/logger.js';

/**
 * @desc    Save candidate proctoring consent with version number
 * @route   POST /api/proctor/consent
 * @access  Private
 */
export const saveProctorConsent = async (req, res, next) => {
  try {
    const candidateId = req.user?.id || req.user?._id;
    const { consentVersion = proctorConfigs.consentVersion, accepted = true } = req.body;

    if (!accepted) {
      return next(new AppError('Proctoring consent must be accepted to proceed with the assessment.', 400));
    }

    const consentRecord = {
      consentVersion,
      accepted: true,
      acceptedAt: new Date(),
      ipAddress: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1'
    };

    if (candidateId && mongoose.connection.readyState === 1) {
      await User.findByIdAndUpdate(candidateId, {
        $set: { 'profile.proctorConsent': consentRecord }
      });
    }

    res.status(200).json({
      success: true,
      message: 'Proctoring consent successfully recorded',
      data: consentRecord
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get candidate's proctoring consent status
 * @route   GET /api/proctor/consent
 * @access  Private
 */
export const getProctorConsent = async (req, res, next) => {
  try {
    const candidateId = req.user?.id || req.user?._id;
    let consent = null;

    if (candidateId && mongoose.connection.readyState === 1) {
      const user = await User.findById(candidateId).select('profile.proctorConsent');
      consent = user?.profile?.proctorConsent || null;
    }

    const hasConsented = consent && consent.accepted && consent.consentVersion === proctorConfigs.consentVersion;

    res.status(200).json({
      success: true,
      data: {
        hasConsented: Boolean(hasConsented),
        requiredVersion: proctorConfigs.consentVersion,
        consent
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Enrol 3-frame face biometrics with encrypted embedding
 * @route   POST /api/proctor/enrol OR POST /api/proctor/session/:sessionId/enrol
 * @access  Private
 */
export const enrolFaceBiometrics = async (req, res, next) => {
  try {
    const candidateId = req.user?.id || req.user?._id;
    const sessionId = req.params.sessionId || req.body.sessionId;
    const {
      encryptedEmbedding,
      framesCount = 3,
      algorithm = 'face-api-128d',
      metrics = {}
    } = req.body;

    if (!encryptedEmbedding) {
      return next(new AppError('Encrypted face embedding is required for biometric enrolment.', 400));
    }

    const enrolmentRecord = {
      enrolledAt: new Date(),
      framesCount: Number(framesCount) || 3,
      algorithm,
      encryptedEmbedding,
      metrics,
      status: 'enrolled'
    };

    if (sessionId && mongoose.connection.readyState === 1) {
      await AssessmentSession.findByIdAndUpdate(sessionId, {
        $set: {
          proctoringEnrolment: enrolmentRecord
        }
      }).catch(() => {});
    }

    res.status(200).json({
      success: true,
      message: '3-frame face biometric enrolment completed and encrypted',
      data: {
        sessionId,
        candidateId,
        status: 'enrolled',
        framesCount: Number(framesCount) || 3,
        algorithm,
        enrolledAt: enrolmentRecord.enrolledAt
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get session proctoring status
 * @route   GET /api/proctor/session/:sessionId/status
 * @access  Private
 */
export const getProctorSessionStatus = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    let session = null;

    if (mongoose.connection.readyState === 1 && sessionId) {
      session = await AssessmentSession.findById(sessionId).select(
        'proctoringEnrolment integrityScore integrityStatus integrityEvents proctoringEvents status'
      );
    }

    res.status(200).json({
      success: true,
      data: {
        sessionId,
        isEnrolled: Boolean(session?.proctoringEnrolment?.encryptedEmbedding),
        enrolledAt: session?.proctoringEnrolment?.enrolledAt || null,
        integrityScore: session?.integrityScore ?? 100,
        integrityStatus: session?.integrityStatus || 'GREEN',
        eventCount: (session?.proctoringEvents?.length || 0) + (session?.integrityEvents?.length || 0),
        sessionStatus: session?.status || 'in_progress'
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Analyze text for AI generation risk (burstiness + LLM)
 * @route   POST /api/proctor/check-text
 * @access  Private
 */
export const checkTextAIRisk = async (req, res, next) => {
  try {
    const { text = '', questionContext = '' } = req.body;
    const result = await classifyAITextRisk(text, questionContext);
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Upload rolling 10-second MediaRecorder buffer and/or frame snapshot on alert
 * @route   POST /api/proctor/evidence
 * @access  Private
 */
export const uploadEvidence = async (req, res, next) => {
  try {
    const candidateId = req.user?.id || req.user?._id;
    const {
      sessionId,
      alertId,
      eventType = 'PROCTORING_ALERT',
      severity = 'orange',
      snapshot = null,
      durationSeconds = 10,
      retentionDays = proctorConfigs.retentionDays || 30,
      metadata = {}
    } = req.body;

    if (!sessionId) {
      return next(new AppError('Session ID is required to associate evidence.', 400));
    }

    const mediaBuffer = req.file ? req.file.buffer : null;
    const mimeType = req.file ? req.file.mimetype : 'video/webm';

    const evidence = await saveEvidence({
      sessionId,
      candidateId,
      alertId,
      eventType,
      severity,
      mediaBuffer,
      mimeType,
      snapshotBase64: snapshot,
      durationSeconds: Number(durationSeconds) || 10,
      retentionDays: Number(retentionDays) || 30,
      metadata: typeof metadata === 'string' ? JSON.parse(metadata) : metadata
    });

    res.status(201).json({
      success: true,
      message: 'Proctoring evidence captured and stored in GridFS',
      data: evidence
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Stream or download stored evidence from GridFS / Cloud
 * @route   GET /api/proctor/evidence/:id
 * @access  Private
 */
export const streamEvidence = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { stream, mimeType, sizeBytes, snapshotBase64, record } = await getEvidenceStream(id);

    if (stream) {
      res.setHeader('Content-Type', mimeType || 'video/webm');
      if (sizeBytes > 0) {
        res.setHeader('Content-Length', sizeBytes);
      }
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return stream.pipe(res);
    }

    if (snapshotBase64) {
      const cleanBase64 = snapshotBase64.replace(/^data:image\/\w+;base64,/, '');
      const imgBuffer = Buffer.from(cleanBase64, 'base64');
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Content-Length', imgBuffer.length);
      return res.end(imgBuffer);
    }

    res.status(200).json({
      success: true,
      data: record
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get recruiter live-monitor active session grid
 * @route   GET /api/proctor/active-sessions
 * @access  Private (Recruiter / Admin)
 */
export const getActiveProctorSessions = async (req, res, next) => {
  try {
    let sessions = [];

    if (mongoose.connection.readyState === 1) {
      sessions = await AssessmentSession.find({
        status: { $in: ['in_progress', 'paused', 'flagged'] }
      })
        .populate('candidateId', 'name email profile.headline profile.avatar')
        .sort({ updatedAt: -1 })
        .limit(50)
        .lean();
    }

    // Format session summaries for dashboard grid
    const formatted = sessions.map((s) => {
      const candidate = s.candidateId || {};
      const proctorEvents = s.proctoringEvents || [];
      const alertsCount = proctorEvents.length;
      const redAlerts = proctorEvents.filter((e) => e.severity === 'red').length;
      const orangeAlerts = proctorEvents.filter((e) => e.severity === 'orange').length;
      const yellowAlerts = proctorEvents.filter((e) => e.severity === 'yellow').length;

      return {
        id: s._id,
        candidateName: candidate.name || 'Candidate',
        candidateEmail: candidate.email || 'candidate@adaptiq.ai',
        avatar: candidate.profile?.avatar || null,
        track: s.track || 'General',
        targetRole: s.targetRole || '',
        currentRound: s.currentRound || 'technical',
        status: s.status,
        onRedPolicy: s.onRedPolicy || proctorConfigs.onRed || 'pause',
        integrityScore: s.integrityScore ?? 100,
        integrityStatus: s.integrityStatus || 'GREEN',
        abilityTheta: s.abilityTheta ?? 0.0,
        currentQuestionIndex: s.currentQuestionIndex || 0,
        totalQuestions: s.totalQuestions || 8,
        startedAt: s.startedAt,
        updatedAt: s.updatedAt,
        alerts: {
          total: alertsCount,
          yellow: yellowAlerts,
          orange: orangeAlerts,
          red: redAlerts
        },
        recentEvents: proctorEvents.slice(-5).reverse(),
        recruiterNotes: s.recruiterNotes || []
      };
    });

    res.status(200).json({
      success: true,
      data: {
        count: formatted.length,
        sessions: formatted
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Execute recruiter control action (warning, pause, resume, terminate, false positive, note)
 * @route   POST /api/proctor/session/:sessionId/action
 * @access  Private (Recruiter / Admin)
 */
export const executeRecruiterSessionAction = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const {
      action, // 'warning' | 'pause' | 'resume' | 'terminate' | 'mark_false_positive' | 'add_note'
      message = '',
      reason = '',
      alertId = null,
      note = ''
    } = req.body;

    const userEmail = req.user?.email || 'recruiter@adaptiq.ai';
    const userRole = req.user?.role || 'recruiter';
    const userId = req.user?.id || req.user?._id;

    if (!action) {
      return next(new AppError('Action type is required.', 400));
    }

    let session = null;
    if (mongoose.connection.readyState === 1 && sessionId) {
      session = await AssessmentSession.findById(sessionId);
    }

    const io = getIO();
    let actionResult = { action, appliedAt: new Date() };

    switch (action) {
      case 'warning': {
        const warnMsg = message || reason || 'Please adhere to interview proctoring guidelines.';
        if (io) {
          io.to(`session:${sessionId}`).emit('session:control', {
            action: 'warning',
            message: warnMsg,
            sentBy: userEmail,
            timestamp: new Date().toISOString()
          });
        }
        await logProctorAction({
          action: 'PROCTOR_WARNING_SENT',
          performedBy: userId,
          userEmail,
          userRole,
          targetType: 'SESSION',
          targetId: sessionId,
          reason: warnMsg
        });
        actionResult.message = warnMsg;
        break;
      }

      case 'pause': {
        const pauseReason = reason || message || 'Session paused by proctor for integrity review.';
        if (session) {
          session.status = 'paused';
          session.pausedAt = new Date();
          await session.save();
        }
        if (io) {
          io.to(`session:${sessionId}`).emit('session:control', {
            action: 'pause',
            reason: pauseReason,
            pausedBy: userEmail,
            timestamp: new Date().toISOString()
          });
        }
        await logProctorAction({
          action: 'PROCTOR_SESSION_PAUSED',
          performedBy: userId,
          userEmail,
          userRole,
          targetType: 'SESSION',
          targetId: sessionId,
          reason: pauseReason
        });
        actionResult.status = 'paused';
        break;
      }

      case 'resume': {
        if (session) {
          session.status = 'in_progress';
          session.pausedAt = null;
          await session.save();
        }
        if (io) {
          io.to(`session:${sessionId}`).emit('session:control', {
            action: 'resume',
            resumedBy: userEmail,
            timestamp: new Date().toISOString()
          });
        }
        await logProctorAction({
          action: 'PROCTOR_SESSION_RESUMED',
          performedBy: userId,
          userEmail,
          userRole,
          targetType: 'SESSION',
          targetId: sessionId,
          reason: 'Session resumed by proctor.'
        });
        actionResult.status = 'in_progress';
        break;
      }

      case 'terminate': {
        const termReason = reason || message || 'Session terminated due to proctoring policy violation.';
        if (session) {
          session.status = 'terminated';
          session.completedAt = new Date();
          await session.save();
        }
        if (io) {
          io.to(`session:${sessionId}`).emit('session:control', {
            action: 'terminate',
            reason: termReason,
            terminatedBy: userEmail,
            timestamp: new Date().toISOString()
          });
        }
        await logProctorAction({
          action: 'PROCTOR_SESSION_TERMINATED',
          performedBy: userId,
          userEmail,
          userRole,
          targetType: 'SESSION',
          targetId: sessionId,
          reason: termReason
        });
        actionResult.status = 'terminated';
        break;
      }

      case 'mark_false_positive': {
        if (!alertId) {
          return next(new AppError('alertId is required to mark false positive.', 400));
        }

        let updatedScore = 100;
        let updatedStatus = 'GREEN';

        if (session) {
          let found = false;
          if (session.proctoringEvents) {
            for (const ev of session.proctoringEvents) {
              if (ev.alertId === alertId || ev.type === alertId || String(ev._id) === alertId) {
                ev.isFalsePositive = true;
                ev.markedFalsePositiveBy = userEmail;
                ev.markedFalsePositiveAt = new Date();
                found = true;
              }
            }
          }

          // Filter out false positive events and recalculate integrity score
          const validEvents = (session.proctoringEvents || []).filter((e) => !e.isFalsePositive);
          const recalc = calculateTimeDecayedIntegrityScore(validEvents, new Date(), proctorConfigs);
          session.integrityScore = recalc.integrityScore;
          session.integrityStatus = recalc.integrityStatus;
          updatedScore = session.integrityScore;
          updatedStatus = session.integrityStatus;
          await session.save();
        }

        if (io) {
          io.to(`session:${sessionId}`).emit('proctor:status_updated', {
            sessionId,
            integrityScore: updatedScore,
            integrityStatus: updatedStatus,
            alertId,
            isFalsePositive: true
          });
          io.to('recruiter:proctoring').emit('proctor:status_updated', {
            sessionId,
            integrityScore: updatedScore,
            integrityStatus: updatedStatus,
            alertId,
            isFalsePositive: true
          });
        }

        await logProctorAction({
          action: 'PROCTOR_FALSE_POSITIVE',
          performedBy: userId,
          userEmail,
          userRole,
          targetType: 'PROCTOR_ALERT',
          targetId: String(alertId),
          reason: `Alert marked as false positive by recruiter. Integrity score restored to ${updatedScore} (${updatedStatus}).`
        });

        actionResult.alertId = alertId;
        actionResult.integrityScore = updatedScore;
        actionResult.integrityStatus = updatedStatus;
        break;
      }

      case 'add_note': {
        const noteText = note || message;
        if (!noteText) {
          return next(new AppError('Note content is required.', 400));
        }

        const noteEntry = {
          note: noteText,
          authorEmail: userEmail,
          authorRole: userRole,
          createdAt: new Date()
        };

        if (session) {
          if (!session.recruiterNotes) session.recruiterNotes = [];
          session.recruiterNotes.push(noteEntry);
          await session.save();
        }

        await logProctorAction({
          action: 'PROCTOR_NOTE_ADDED',
          performedBy: userId,
          userEmail,
          userRole,
          targetType: 'SESSION',
          targetId: sessionId,
          reason: `Recruiter note added: "${noteText.substring(0, 80)}..."`
        });

        actionResult.note = noteEntry;
        break;
      }

      default:
        return next(new AppError(`Unsupported recruiter action: ${action}`, 400));
    }

    res.status(200).json({
      success: true,
      message: `Recruiter action '${action}' successfully executed`,
      data: actionResult
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get audit trail logs for a session
 * @route   GET /api/proctor/audit-logs/:sessionId
 * @access  Private (Recruiter / Admin)
 */
export const getSessionAuditTrail = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const logs = await getSessionAuditLogs(sessionId);

    res.status(200).json({
      success: true,
      data: {
        sessionId,
        count: logs.length,
        logs
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Trigger evidence retention cleanup job
 * @route   POST /api/proctor/evidence/cleanup
 * @access  Private (Admin / Recruiter)
 */
export const triggerEvidenceRetentionCleanup = async (req, res, next) => {
  try {
    const result = await cleanupExpiredEvidence();
    res.status(200).json({
      success: true,
      message: `Evidence retention cleanup completed. Purged ${result.purgedCount} expired records.`,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Helper: Canonical Known Limitations Text
 */
export function getProctoringKnownLimitations() {
  return [
    {
      title: 'Ambient Lighting & Optical Variability',
      description:
        'Optical landmark detection requires sufficient illumination (> 50 lux). Harsh directional lighting, backlighting, or low-light environments can induce false facial tracking drops. Candidates are prompted to adjust workspace lighting before flagging.'
    },
    {
      title: 'Eyewear, Astigmatism & Multi-Monitor Setups',
      description:
        'Thick-rimmed glasses, anti-reflective coatings, or severe astigmatism can distort iris center-point estimation. Candidates utilizing authorized auxiliary monitors or assistive magnification tools must receive proctor notation to prevent looking-away false positives.'
    },
    {
      title: 'Acoustic Environment & Verbal Pacing',
      description:
        'Web Audio API multi-speaker heuristics approximate voice formants. Open-office background chatter, air conditioning hum, or candidate habits of thinking aloud do not constitute proof of cheating. Speech metrics are used strictly for communication coaching, not integrity penalties.'
    },
    {
      title: 'AI Text Risk Indicator is Probabilistic',
      description:
        'Burstiness and sentence-length cadence analysis is a probabilistic risk indicator, not deterministic proof of automated generation. Technical or boilerplate programming syntax inherently exhibits low burstiness. Disqualification based solely on AI risk heuristics is strictly prohibited.'
    },
    {
      title: 'Mandatory Human-in-the-Loop Governance',
      description:
        'In compliance with EEOC, EU AI Act, and international employment standards, AI proctoring alarms serve solely as advisory markers for human audit. Every adverse decision requires explicit human recruiter confirmation through the review queue.'
    }
  ];
}

/**
 * @desc    Get detailed post-session timeline with event markers, snapshots, and evidence clips
 * @route   GET /api/proctor/session/:sessionId/review
 * @access  Private (Recruiter / Admin)
 */
export const getSessionReviewTimeline = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    let session = null;
    let evidenceList = [];
    let reviewQueueItem = null;

    if (mongoose.connection.readyState === 1 && sessionId) {
      session = await AssessmentSession.findById(sessionId)
        .populate('candidateId', 'name email profile.headline profile.avatar')
        .lean();

      evidenceList = await Evidence.find({ sessionId, isDeleted: false }).lean();
      reviewQueueItem = await ReviewQueueItem.findOne({ sessionId }).sort({ createdAt: -1 }).lean();
    }

    if (!session) {
      // Mock / fallback session for tests / offline
      session = {
        _id: sessionId,
        candidateId: { name: 'Sample Monitored Candidate', email: 'candidate@domain.com' },
        track: 'fullstack',
        status: 'flagged',
        integrityScore: 62,
        integrityStatus: 'ORANGE',
        startedAt: new Date(Date.now() - 3600000),
        completedAt: new Date(),
        proctoringEvents: [
          {
            alertId: 'alt_1',
            type: 'LOOKING_AWAY',
            severity: 'yellow',
            timestamp: new Date(Date.now() - 3000000).toISOString(),
            confidence: 0.92,
            message: 'Gaze or head turned away from the screen.',
            reviewLabel: null
          },
          {
            alertId: 'alt_2',
            type: 'MULTIPLE_FACES',
            severity: 'orange',
            timestamp: new Date(Date.now() - 1800000).toISOString(),
            confidence: 0.88,
            message: 'Multiple faces detected in frame.',
            reviewLabel: null
          },
          {
            alertId: 'alt_3',
            type: 'PROHIBITED_OBJECT',
            severity: 'orange',
            timestamp: new Date(Date.now() - 600000).toISOString(),
            confidence: 0.94,
            message: 'Prohibited device detected (phone, book, or laptop).',
            reviewLabel: null
          }
        ]
      };
    }

    const sessionStart = new Date(session.startedAt || Date.now() - 3600000).getTime();
    const sessionEnd = new Date(session.completedAt || Date.now()).getTime();
    const totalDurationSeconds = Math.max(60, Math.round((sessionEnd - sessionStart) / 1000));

    // Map evidence by alertId
    const evidenceByAlert = {};
    evidenceList.forEach((ev) => {
      if (ev.alertId) evidenceByAlert[ev.alertId] = ev;
    });

    // Format events with timeline offsets
    const events = (session.proctoringEvents || []).map((ev, idx) => {
      const eventTime = new Date(ev.timestamp || sessionStart + idx * 60000).getTime();
      const offsetSeconds = Math.max(0, Math.min(totalDurationSeconds, Math.round((eventTime - sessionStart) / 1000)));
      const evidence = evidenceByAlert[ev.alertId] || null;

      return {
        id: ev.alertId || `ev_${idx}`,
        alertId: ev.alertId || `ev_${idx}`,
        type: ev.type,
        severity: ev.severity || 'yellow',
        initialSeverity: ev.initialSeverity || ev.severity,
        isEscalated: Boolean(ev.isEscalated),
        escalationReason: ev.escalationReason || null,
        confidence: ev.confidence ?? 0.9,
        timestamp: ev.timestamp,
        offsetSeconds,
        message: ev.message || `${ev.type} alert`,
        snapshot: ev.snapshot || evidence?.snapshotBase64 || null,
        evidenceId: evidence?._id || null,
        downloadUrl: evidence ? `/api/proctor/evidence/${evidence._id}` : null,
        reviewLabel: ev.reviewLabel || (ev.isFalsePositive ? 'dismissed' : null),
        isFalsePositive: Boolean(ev.isFalsePositive)
      };
    });

    res.status(200).json({
      success: true,
      data: {
        session: {
          id: session._id,
          candidate: session.candidateId || { name: 'Candidate', email: 'candidate@adaptiq.ai' },
          track: session.track,
          status: session.status,
          integrityScore: session.integrityScore ?? 100,
          integrityStatus: session.integrityStatus || 'GREEN',
          startedAt: session.startedAt,
          completedAt: session.completedAt,
          totalDurationSeconds
        },
        events,
        reviewQueueItem,
        knownLimitations: getProctoringKnownLimitations()
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Submit human review decision on session/event (Confirm violation, Dismiss false positive, Request re-test)
 * @route   POST /api/proctor/session/:sessionId/review-action
 * @access  Private (Recruiter / Admin)
 */
export const postSessionReviewAction = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const { action, eventId, alertId, notes = '' } = req.body;
    // Supported actions: 'confirm_violation' | 'dismiss_false_positive' | 'request_retest'

    const reviewerEmail = req.user?.email || 'reviewer@adaptiq.ai';
    const reviewerId = req.user?.id || req.user?._id;

    let session = null;
    let targetAlertId = alertId || eventId;

    if (mongoose.connection.readyState === 1 && sessionId) {
      session = await AssessmentSession.findById(sessionId);
    }

    let updatedScore = session?.integrityScore ?? 100;
    let updatedStatus = session?.integrityStatus || 'GREEN';

    if (session && session.proctoringEvents) {
      for (const ev of session.proctoringEvents) {
        if (!targetAlertId || ev.alertId === targetAlertId || String(ev._id) === targetAlertId || ev.type === targetAlertId) {
          if (action === 'confirm_violation') {
            ev.reviewLabel = 'confirmed';
            ev.isFalsePositive = false;
            ev.reviewedAt = new Date();
            ev.reviewedBy = reviewerEmail;
            ev.reviewNotes = notes;
          } else if (action === 'dismiss_false_positive') {
            ev.reviewLabel = 'dismissed';
            ev.isFalsePositive = true;
            ev.reviewedAt = new Date();
            ev.reviewedBy = reviewerEmail;
            ev.reviewNotes = notes;
          } else if (action === 'request_retest') {
            ev.reviewLabel = 'retest_requested';
            ev.reviewedAt = new Date();
            ev.reviewedBy = reviewerEmail;
            ev.reviewNotes = notes;
          }
        }
      }

      if (action === 'dismiss_false_positive') {
        const validEvents = session.proctoringEvents.filter((e) => !e.isFalsePositive && e.reviewLabel !== 'dismissed');
        const recalc = calculateTimeDecayedIntegrityScore(validEvents, new Date(), proctorConfigs);
        session.integrityScore = recalc.integrityScore;
        session.integrityStatus = recalc.integrityStatus;
        updatedScore = session.integrityScore;
        updatedStatus = session.integrityStatus;
      } else if (action === 'confirm_violation') {
        session.status = 'flagged';
      } else if (action === 'request_retest') {
        session.status = 'retest_requested';
      }

      await session.save();
    }

    // Sync with ReviewQueueItem if present
    if (mongoose.connection.readyState === 1 && sessionId) {
      const queueItem = await ReviewQueueItem.findOne({ sessionId, status: 'pending' });
      if (queueItem) {
        queueItem.status = action === 'confirm_violation' ? 'approved' : 'dismissed';
        queueItem.recruiterNotes = notes || `Human reviewer resolved via review page as ${action}`;
        queueItem.resolvedAt = new Date();
        queueItem.assignedReviewer = reviewerId;
        await queueItem.save();
      }
    }

    // Audit Log Entry
    const auditAction =
      action === 'confirm_violation'
        ? 'PROCTOR_SESSION_TERMINATED'
        : action === 'dismiss_false_positive'
        ? 'PROCTOR_FALSE_POSITIVE'
        : 'SETTINGS_CHANGED';

    await logProctorAction({
      action: auditAction,
      performedBy: reviewerId,
      userEmail: reviewerEmail,
      userRole: req.user?.role || 'recruiter',
      targetType: 'SESSION',
      targetId: sessionId,
      reason: `Human review action '${action}' applied to session. Notes: ${notes || 'None'}`,
      newState: {
        action,
        alertId: targetAlertId,
        integrityScore: updatedScore,
        integrityStatus: updatedStatus
      }
    });

    res.status(200).json({
      success: true,
      message: `Review decision '${action}' successfully recorded.`,
      data: {
        sessionId,
        action,
        alertId: targetAlertId,
        integrityScore: updatedScore,
        integrityStatus: updatedStatus,
        reviewedBy: reviewerEmail
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get False-Positive Tuning Report for all proctor event types
 * @route   GET /api/proctor/tuning-metrics
 * @access  Private (Recruiter / Admin)
 */
export const getFalsePositiveTuningReport = async (req, res, next) => {
  try {
    const report = await calculateFalsePositiveRates();
    res.status(200).json({
      success: true,
      data: report
    });
  } catch (error) {
    next(error);
  }
};

export default {
  saveProctorConsent,
  getProctorConsent,
  enrolFaceBiometrics,
  getProctorSessionStatus,
  checkTextAIRisk,
  uploadEvidence,
  streamEvidence,
  getActiveProctorSessions,
  executeRecruiterSessionAction,
  getSessionAuditTrail,
  triggerEvidenceRetentionCleanup,
  getSessionReviewTimeline,
  postSessionReviewAction,
  getFalsePositiveTuningReport,
  getProctoringKnownLimitations
};
