import { Server } from 'socket.io';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { logger } from '../config/logger.js';
import { AssessmentSession } from '../models/AssessmentSession.js';
import { ReviewQueueItem } from '../models/ReviewQueueItem.js';
import { calculateSessionIntegrityScore, INTEGRITY_PENALTIES } from '../ml/integrityEngine.js';
import { proctorConfigs, evaluateSeverityAndEscalation, calculateTimeDecayedIntegrityScore } from '../config/proctorConfig.js';
import { logProctorAction } from './proctor/auditService.js';

let io = null;
const proctorSessionHistories = new Map();

const getWarningMessage = (type, severity, isEscalated, escalationReason) => {
  let baseMsg = 'Proctoring alert detected.';
  const typeKey = (type || '').toUpperCase();

  switch (typeKey) {
    case 'NO_FACE':
      baseMsg = 'Face not detected in camera frame. Please keep your face clearly in view.';
      break;
    case 'MULTIPLE_FACES':
      baseMsg = 'Multiple faces detected in frame. Only the verified candidate is allowed.';
      break;
    case 'IDENTITY_MISMATCH':
      baseMsg = 'Biometric mismatch: Detected face does not match the enrolled candidate embedding.';
      break;
    case 'LOOKING_AWAY':
      baseMsg = 'Gaze or head turned away from the screen. Please look directly at the screen.';
      break;
    case 'PROHIBITED_OBJECT':
      baseMsg = 'Prohibited device detected (phone, book, or laptop). Please remove it immediately.';
      break;
    case 'CAMERA_BLOCKED_DARK':
      baseMsg = 'Camera view blocked or ambient lighting too dark. Please ensure sufficient lighting.';
      break;
    case 'DEVICE_DISCONNECTED':
      baseMsg = 'Camera or microphone device disconnected or track ended. Please reconnect your device.';
      break;
    case 'FULLSCREEN_EXIT':
      baseMsg = 'Mandatory fullscreen was exited. Please return to fullscreen mode immediately.';
      break;
    case 'TAB_SWITCH':
      baseMsg = 'Tab switch detected. Please stay on the active interview tab.';
      break;
    case 'WINDOW_BLUR':
      baseMsg = 'Window blur detected. Please keep the interview window active and focused.';
      break;
    case 'CLIPBOARD_ACTION':
      baseMsg = 'External clipboard action detected (copy/cut/paste).';
      break;
    case 'RIGHT_CLICK':
      baseMsg = 'Context menu / right-click detected. Secondary click shortcuts are restricted.';
      break;
    case 'DEVTOOLS_SHORTCUT':
      baseMsg = 'Developer tools keyboard shortcut detected. Inspect element shortcuts are restricted.';
      break;
    case 'WINDOW_RESIZE_EXTRA_MONITOR':
      baseMsg = 'Suspicious window resize or secondary display monitor arrangement detected.';
      break;
    case 'VIRTUAL_CAMERA':
      baseMsg = 'Virtual camera software (OBS/ManyCam/Loopback) detected. Only physical webcams are permitted.';
      break;
    case 'TYPING_ANOMALY_LARGE_PASTE':
      baseMsg = 'Large paste burst detected. Candidates must type answers organically.';
      break;
    case 'TYPING_ANOMALY_UNIFORM_KEYSTROKES':
      baseMsg = 'Inhuman / uniform keystroke cadence anomaly detected. Macro scripts are prohibited.';
      break;
    case 'IMPLAUSIBLY_FAST_ANSWER':
      baseMsg = 'Answer submitted with implausibly fast completion velocity.';
      break;
    case 'AI_TEXT_RISK_INDICATOR':
      baseMsg = 'AI-generated text risk indicator flagged (Risk indicator only - subject to human review).';
      break;
    case 'SPEECH_IN_WRITE_MODE':
      baseMsg = 'Speech detected while in writing mode. Please maintain quiet focus.';
      break;
    case 'LIPS_MOVING_NO_AUDIO':
      baseMsg = 'Lip movement detected without audio. Please verify your microphone is active.';
      break;
    case 'TWO_SPEAKER_HEURISTIC':
      baseMsg = 'Multiple distinct speaker voices detected in candidate audio stream.';
      break;
    default:
      baseMsg = `Proctoring alert: ${type}`;
  }

  if (isEscalated && escalationReason) {
    return `${baseMsg} (${escalationReason.toUpperCase()})`;
  }
  return baseMsg;
};

/**
 * Initializes Socket.io with HTTP server
 * @param {import('http').Server} httpServer
 * @param {string} clientUrl
 */
export const initSocket = (httpServer, clientUrl = '*') => {
  io = new Server(httpServer, {
    cors: {
      origin: [clientUrl, 'http://localhost:5173', 'http://127.0.0.1:5173'],
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // Authenticate Socket.io connection via JWT
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        (socket.handshake.headers?.authorization && socket.handshake.headers.authorization.replace('Bearer ', ''));

      if (!token) {
        return next(new Error('Authentication error: Missing token'));
      }

      const decoded = jwt.verify(token, env.JWT_SECRET);
      if (!decoded || !decoded.id) {
        return next(new Error('Authentication error: Invalid token'));
      }

      let user = null;
      if (mongoose.connection.readyState === 1) {
        try {
          user = await User.findById(decoded.id).select('-password');
        } catch (e) {
          logger.warn(`Could not load user in socket authentication: ${e.message}`);
        }
      }

      if (!user) {
        user = {
          _id: decoded.id,
          id: decoded.id,
          email: decoded.email,
          role: decoded.role || 'candidate',
          name: decoded.name
        };
      }

      socket.data.user = user;
      next();
    } catch (err) {
      return next(new Error('Authentication error: ' + (err.message || 'Invalid token')));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`🔌 Socket connected: ${socket.id} (${socket.data?.user?.email || 'authenticated'})`);

    // Join a specific assessment session room (candidate must be session owner, or recruiter/admin)
    socket.on('join_session', async (sessionId) => {
      const user = socket.data?.user;
      if (!user) {
        socket.emit('error', { message: 'Unauthorized: User not found' });
        return;
      }

      // Recruiters and admins can join any session room
      if (user.role === 'recruiter' || user.role === 'admin') {
        socket.join(`session:${sessionId}`);
        logger.info(`Privileged socket ${socket.id} (${user.role}) joined room session:${sessionId}`);
        return;
      }

      // Candidate must own the session
      if (mongoose.connection.readyState === 1 && sessionId) {
        try {
          const session = await AssessmentSession.findById(sessionId).select('userId candidateId');
          if (session) {
            const ownerId = String(session.userId || session.candidateId || '');
            const userId = String(user._id || user.id || '');
            if (ownerId && userId && ownerId !== userId) {
              socket.emit('error', { message: 'Forbidden: You do not own this session' });
              return;
            }
          }
        } catch (err) {
          logger.warn(`Session ownership lookup error for socket ${socket.id}: ${err.message}`);
        }
      }

      socket.join(`session:${sessionId}`);
      logger.info(`Socket ${socket.id} joined room session:${sessionId}`);
    });

    // Join admin proctoring stream (recruiter/admin only)
    socket.on('join_admin_proctoring', () => {
      const user = socket.data?.user;
      if (!user || (user.role !== 'recruiter' && user.role !== 'admin')) {
        socket.emit('error', { message: 'Unauthorized: Recruiter or admin role required' });
        return;
      }
      socket.join('admin:proctoring');
      logger.info(`Socket ${socket.id} (${user.role}) joined admin proctoring room`);
    });

    // Join recruiter live-monitor room (recruiter/admin only)
    socket.on('join_recruiter_monitor', () => {
      const user = socket.data?.user;
      if (!user || (user.role !== 'recruiter' && user.role !== 'admin')) {
        socket.emit('error', { message: 'Unauthorized: Recruiter or admin role required' });
        return;
      }
      socket.join('recruiter:proctoring');
      socket.join('admin:proctoring');
      logger.info(`Socket ${socket.id} (${user.role}) joined recruiter live-monitor room`);
    });

    // WebRTC Live Video Signaling (simple-peer) - only recruiter/admin can request video feeds
    socket.on('webrtc:request_feed', ({ sessionId }) => {
      const user = socket.data?.user;
      if (!user || (user.role !== 'recruiter' && user.role !== 'admin')) {
        socket.emit('error', { message: 'Unauthorized: Only recruiters and admins can request video feeds' });
        return;
      }
      logger.info(`📹 WebRTC feed requested for session ${sessionId} by ${socket.id}`);
      socket.to(`session:${sessionId}`).emit('webrtc:feed_requested', {
        sessionId,
        recruiterSocketId: socket.id
      });
    });

    socket.on('webrtc:signal', ({ to, signal, sessionId }) => {
      if (to) {
        io.to(to).emit('webrtc:signal', {
          from: socket.id,
          signal,
          sessionId
        });
      } else {
        socket.to(`session:${sessionId}`).emit('webrtc:signal', {
          from: socket.id,
          signal,
          sessionId
        });
      }
    });

    socket.on('webrtc:stop_feed', ({ sessionId }) => {
      socket.to(`session:${sessionId}`).emit('webrtc:feed_stopped', {
        sessionId,
        recruiterSocketId: socket.id
      });
    });

    // Recruiter manual control events over socket
    socket.on('session:control', async (payload = {}) => {
      const { sessionId, action, message, reason } = payload;
      if (!sessionId || !action) return;
      logger.info(`🎮 Recruiter session:control [${action}] dispatched to session:${sessionId}`);
      io.to(`session:${sessionId}`).emit('session:control', payload);
    });

    // Anti-Cheating Suite: Handle live candidate telemetry events
    // Event types: 'tab_switch', 'fullscreen_exit', 'paste', 'typing_anomaly', 'ai_text_risk_indicator'
    socket.on('client_integrity_event', async ({ sessionId, eventType, metadata = {}, timestamp }) => {
      try {
        const eventTime = timestamp || new Date().toISOString();
        logger.warn(`⚠️ Integrity event [${eventType}] in session ${sessionId} from socket ${socket.id}`);

        let newScore = 95;
        let severity = 'WARNING';
        let deduction = 3;

        // Persist and recalculate if DB connection is active
        if (mongoose.connection.readyState === 1 && sessionId) {
          const session = await AssessmentSession.findById(sessionId);
          if (session) {
            session.integrityEvents.push({
              eventType,
              timestamp: eventTime,
              metadata,
              severity: eventType === 'ai_text_risk_indicator' ? 'CRITICAL' : 'WARNING'
            });

            const scoreEvaluation = calculateSessionIntegrityScore(session.integrityEvents, 100);
            session.integrityScore = scoreEvaluation.finalScore;
            newScore = session.integrityScore;

            // Auto-queue for human review if integrity is compromised
            if (scoreEvaluation.isFlaggedForReview) {
              const existingQueue = await ReviewQueueItem.findOne({
                sessionId,
                triggerReason: 'INTEGRITY_ANOMALY',
                status: 'pending'
              });

              if (!existingQueue) {
                await ReviewQueueItem.create({
                  sessionId,
                  questionId: session.currentQuestion || session.responses[session.responses.length - 1]?.questionId,
                  candidateId: session.userId,
                  candidateName: 'Monitored Candidate',
                  triggerReason: 'INTEGRITY_ANOMALY',
                  severity: newScore < 60 ? 'CRITICAL' : 'HIGH',
                  originalScore: 0,
                  confidenceScore: 0.5,
                  candidateAnswer: 'Proctoring integrity anomalies detected during session.',
                  status: 'pending'
                });
              }
            }

            await session.save();
          }
        }

        // Emit updated integrity state to session room
        io.to(`session:${sessionId}`).emit('session:integrity_alert', {
          eventType,
          timestamp: eventTime,
          metadata,
          integrityScore: newScore
        });

        // Broadcast to proctoring oversight room
        io.to('admin:proctoring').emit('proctor:session_event', {
          sessionId,
          eventType,
          timestamp: eventTime,
          metadata,
          integrityScore: newScore
        });
      } catch (err) {
        logger.warn(`Failed to process integrity event via socket: ${err.message}`);
      }
    });

    // AI Proctoring Event Stream (from useProctor Web Worker)
    socket.on('proctor:event', async (payload = {}) => {
      try {
        const {
          sessionId,
          type,
          severity: initialReqSeverity,
          confidence = 0.9,
          snapshot = null,
          timestamp = new Date().toISOString(),
          durationMs = 0,
          metadata = {}
        } = payload;

        if (!sessionId || !type) {
          return;
        }

        logger.info(`🔍 [Proctor Event] session:${sessionId} type:${type} initSeverity:${initialReqSeverity}`);

        // Get past proctoring events for escalation checks
        const history = proctorSessionHistories.get(sessionId) || [];
        const evaluation = evaluateSeverityAndEscalation(history, {
          type,
          severity: initialReqSeverity,
          durationMs,
          confidence
        }, proctorConfigs);

        const { finalSeverity, isEscalated, escalationReason, counts } = evaluation;

        // Store evaluated event in session proctoring memory
        const recordedEvent = {
          type,
          severity: finalSeverity,
          initialSeverity: evaluation.initialSeverity,
          isEscalated,
          escalationReason,
          confidence,
          snapshot,
          timestamp,
          durationMs,
          metadata
        };
        history.push(recordedEvent);
        proctorSessionHistories.set(sessionId, history);

        // Calculate warning message for candidate
        const warningMessage = getWarningMessage(type, finalSeverity, isEscalated, escalationReason);

        // Compute time-decayed integrity score & status
        const scoreResult = calculateTimeDecayedIntegrityScore(history, timestamp, proctorConfigs);
        const { integrityScore, integrityStatus } = scoreResult;

        // Update DB session record if MongoDB is available
        if (mongoose.connection.readyState === 1 && sessionId) {
          const session = await AssessmentSession.findById(sessionId);
          if (session) {
            if (!session.proctoringEvents) {
              session.proctoringEvents = [];
            }
            session.proctoringEvents.push(recordedEvent);

            session.integrityScore = integrityScore;
            session.integrityStatus = integrityStatus;

            const onRedPolicy = session.onRedPolicy || proctorConfigs.onRed || 'pause';

            // If Red severity reached (e.g. 3 oranges -> red, or identity mismatch) or RED status
            if (finalSeverity === 'red' || integrityStatus === 'RED') {
              if (onRedPolicy === 'terminate') {
                session.status = 'terminated';
                session.completedAt = new Date();
                io.to(`session:${sessionId}`).emit('session:control', {
                  action: 'terminate',
                  reason: 'Automated Policy: Session terminated due to RED proctoring escalation.',
                  timestamp
                });
                await logProctorAction({
                  action: 'PROCTOR_ON_RED_TRIGGERED',
                  targetType: 'SESSION',
                  targetId: sessionId,
                  reason: 'Automated session termination triggered by proctorConfig.onRed = terminate.'
                }).catch(() => {});
              } else if (onRedPolicy === 'pause') {
                session.status = 'paused';
                session.pausedAt = new Date();
                io.to(`session:${sessionId}`).emit('session:control', {
                  action: 'pause',
                  reason: 'Automated Policy: Session paused due to RED proctoring escalation. Awaiting recruiter review.',
                  timestamp
                });
                await logProctorAction({
                  action: 'PROCTOR_ON_RED_TRIGGERED',
                  targetType: 'SESSION',
                  targetId: sessionId,
                  reason: 'Automated session pause triggered by proctorConfig.onRed = pause.'
                }).catch(() => {});
              } else {
                session.status = 'flagged';
              }

              logger.warn(`🚨 Session ${sessionId} escalated to RED (status: ${integrityStatus}, onRed: ${onRedPolicy})`);

              const existingQueue = await ReviewQueueItem.findOne({
                sessionId,
                triggerReason: 'PROCTORING_ESCALATION_RED',
                status: 'pending'
              });

              if (!existingQueue) {
                await ReviewQueueItem.create({
                  sessionId,
                  questionId: session.currentQuestion || session.responses?.[session.responses.length - 1]?.questionId,
                  candidateId: session.candidateId || session.userId,
                  candidateName: 'Candidate Under Proctor Review',
                  triggerReason: 'PROCTORING_ESCALATION_RED',
                  severity: 'CRITICAL',
                  originalScore: 0,
                  confidenceScore: confidence,
                  candidateAnswer: `Flagged by AI Proctor: ${type} - ${warningMessage}`,
                  status: 'pending'
                }).catch((e) => logger.warn(`Queue creation notice: ${e.message}`));
              }
            }

            await session.save().catch((e) => logger.warn(`Session proctor save notice: ${e.message}`));
          }
        }

        const alertId = `alert_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

        // Candidate-side and Recruiter alert payload
        const alertPayload = {
          alertId,
          sessionId,
          type,
          severity: finalSeverity,
          initialSeverity: evaluation.initialSeverity,
          isEscalated,
          escalationReason,
          confidence,
          message: warningMessage,
          snapshot,
          counts,
          integrityScore,
          integrityStatus,
          timestamp
        };

        // Emit proctor:warning to candidate session room
        io.to(`session:${sessionId}`).emit('proctor:warning', alertPayload);

        // Emit proctor:alert live event feed to recruiter and admin rooms
        io.to('recruiter:proctoring').emit('proctor:alert', alertPayload);
        io.to('admin:proctoring').emit('proctor:alert', alertPayload);
        io.to(`session:${sessionId}`).emit('proctor:alert', alertPayload);

        // Broadcast to proctoring session event stream
        io.to('admin:proctoring').emit('proctor:session_event', alertPayload);

        // Record alert in AuditLog
        await logProctorAction({
          action: 'PROCTOR_ALERT',
          targetType: 'SESSION',
          targetId: sessionId,
          reason: `${finalSeverity.toUpperCase()} proctor alert: ${type} - ${warningMessage}`,
          newState: {
            alertId,
            type,
            severity: finalSeverity,
            confidence,
            integrityScore,
            integrityStatus
          }
        }).catch((err) => logger.warn(`Failed to log alert audit: ${err.message}`));
      } catch (err) {
        logger.error(`Error processing proctor:event in socket: ${err.message}`);
      }
    });

    socket.on('disconnect', () => {
      logger.info(`🔌 Socket disconnected: ${socket.id}`);
    });
  });

  return io;
};

/**
 * Get active Socket.io instance
 */
export const getIO = () => {
  return io;
};

/**
 * Emit ability updates to session room
 */
export const emitAbilityUpdate = (sessionId, payload) => {
  if (io) {
    io.to(`session:${sessionId}`).emit('session:ability_updated', payload);
  }
};

/**
 * Emit session completion
 */
export const emitSessionCompleted = (sessionId, payload) => {
  if (io) {
    io.to(`session:${sessionId}`).emit('session:completed', payload);
  }
};

export default { initSocket, getIO, emitAbilityUpdate, emitSessionCompleted };