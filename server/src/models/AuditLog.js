import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: [
        'SCORE_OVERRIDE',
        'QUESTION_QUARANTINE',
        'QUESTION_RELEASE',
        'FAIRNESS_AUDIT_EXPORT',
        'REVIEW_APPROVED',
        'SETTINGS_CHANGED',
        'PROCTOR_ALERT',
        'PROCTOR_WARNING_SENT',
        'PROCTOR_SESSION_PAUSED',
        'PROCTOR_SESSION_RESUMED',
        'PROCTOR_SESSION_TERMINATED',
        'PROCTOR_FALSE_POSITIVE',
        'PROCTOR_NOTE_ADDED',
        'PROCTOR_ON_RED_TRIGGERED',
        'PROCTOR_EVIDENCE_DELETED'
      ],
      required: true,
      index: true
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    userEmail: {
      type: String,
      default: 'system@adaptiq.ai'
    },
    userRole: {
      type: String,
      default: 'system'
    },
    targetType: {
      type: String,
      enum: ['SESSION', 'QUESTION', 'REVIEW_ITEM', 'FAIRNESS_SYSTEM', 'PROCTOR_ALERT', 'EVIDENCE'],
      required: true
    },
    targetId: {
      type: String,
      required: true
    },
    previousState: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    newState: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    reason: {
      type: String,
      required: true
    },
    ipAddress: {
      type: String,
      default: '127.0.0.1'
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: true
  }
);

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
export default AuditLog;