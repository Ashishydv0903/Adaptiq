import mongoose from 'mongoose';

const fairnessAuditSchema = new mongoose.Schema(
  {
    auditDate: {
      type: Date,
      default: Date.now
    },
    sampleSize: {
      total: { type: Number, required: true },
      privileged: { type: Number, required: true },
      unprivileged: { type: Number, required: true }
    },
    metrics: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    flags: [
      {
        metric: { type: String, required: true },
        severity: { type: String, enum: ['INFO', 'WARNING', 'CRITICAL'], default: 'WARNING' },
        message: { type: String, required: true }
      }
    ],
    isCompliant: {
      type: Boolean,
      required: true
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    notes: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

export const FairnessAudit = mongoose.model('FairnessAudit', fairnessAuditSchema);
export default FairnessAudit;
