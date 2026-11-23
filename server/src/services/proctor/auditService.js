import mongoose from 'mongoose';
import { AuditLog } from '../../models/AuditLog.js';
import { logger } from '../../config/logger.js';

// In-memory ring buffer for audit logs when DB is in memory / test mode
const inMemoryAuditLogs = [];
const MAX_IN_MEMORY_LOGS = 500;

/**
 * Log a proctoring or recruiter audit event
 *
 * @param {Object} params
 * @param {string} params.action - Action enum (e.g. PROCTOR_ALERT, PROCTOR_WARNING_SENT, PROCTOR_SESSION_PAUSED, etc.)
 * @param {string} [params.performedBy] - User ObjectId
 * @param {string} [params.userEmail='system@adaptiq.ai'] - Email of actor
 * @param {string} [params.userRole='system'] - Role of actor ('recruiter' | 'admin' | 'candidate' | 'system')
 * @param {string} [params.targetType='SESSION'] - Target type
 * @param {string} params.targetId - Session or Alert ID
 * @param {string} params.reason - Human-readable reason or alert summary
 * @param {Object} [params.previousState={}]
 * @param {Object} [params.newState={}]
 * @param {string} [params.ipAddress='127.0.0.1']
 * @returns {Promise<Object>} Created audit log record
 */
export async function logProctorAction({
  action,
  performedBy = null,
  userEmail = 'system@adaptiq.ai',
  userRole = 'system',
  targetType = 'SESSION',
  targetId,
  reason,
  previousState = {},
  newState = {},
  ipAddress = '127.0.0.1'
}) {
  const auditEntry = {
    action,
    performedBy: performedBy && mongoose.Types.ObjectId.isValid(performedBy) ? performedBy : null,
    userEmail,
    userRole,
    targetType,
    targetId: String(targetId || 'unknown'),
    reason: reason || action,
    previousState,
    newState,
    ipAddress,
    timestamp: new Date()
  };

  try {
    if (mongoose.connection.readyState === 1) {
      const doc = await AuditLog.create(auditEntry);
      return doc.toObject();
    }
  } catch (err) {
    logger.warn(`Failed to persist audit log to MongoDB: ${err.message}`);
  }

  // Fallback in-memory persistence
  inMemoryAuditLogs.unshift(auditEntry);
  if (inMemoryAuditLogs.length > MAX_IN_MEMORY_LOGS) {
    inMemoryAuditLogs.pop();
  }

  return auditEntry;
}

/**
 * Retrieve audit trail for a target session
 *
 * @param {string} sessionId
 * @returns {Promise<Array>} List of audit logs
 */
export async function getSessionAuditLogs(sessionId) {
  try {
    if (mongoose.connection.readyState === 1 && sessionId) {
      const logs = await AuditLog.find({ targetId: String(sessionId) })
        .sort({ timestamp: -1 })
        .limit(100)
        .lean();
      if (logs.length > 0) return logs;
    }
  } catch (err) {
    logger.warn(`Failed to fetch audit logs from DB: ${err.message}`);
  }

  return inMemoryAuditLogs.filter((l) => l.targetId === String(sessionId));
}

export default {
  logProctorAction,
  getSessionAuditLogs
};
