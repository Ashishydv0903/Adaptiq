import mongoose from 'mongoose';

const evidenceSchema = new mongoose.Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AssessmentSession',
      required: true,
      index: true
    },
    candidateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    alertId: {
      type: String,
      index: true
    },
    eventType: {
      type: String,
      required: true
    },
    severity: {
      type: String,
      enum: ['yellow', 'orange', 'red'],
      default: 'orange'
    },
    mediaType: {
      type: String,
      enum: ['video_buffer', 'snapshot', 'hybrid'],
      default: 'video_buffer'
    },
    storageProvider: {
      type: String,
      enum: ['gridfs', 'cloudinary', 's3', 'local'],
      default: 'gridfs'
    },
    gridFsFileId: {
      type: mongoose.Schema.Types.ObjectId
    },
    fileKey: {
      type: String
    },
    downloadUrl: {
      type: String
    },
    mimeType: {
      type: String,
      default: 'video/webm'
    },
    sizeBytes: {
      type: Number,
      default: 0
    },
    durationSeconds: {
      type: Number,
      default: 10
    },
    snapshotBase64: {
      type: String,
      default: null
    },
    capturedAt: {
      type: Date,
      default: Date.now,
      index: true
    },
    expiresAt: {
      type: Date,
      index: true
    },
    retentionDays: {
      type: Number,
      default: 30
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true
    },
    deletedAt: {
      type: Date,
      default: null
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

// Auto-compute expiresAt before save if not provided
evidenceSchema.pre('save', function (next) {
  if (!this.expiresAt) {
    const days = this.retentionDays || 30;
    this.expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }
  next();
});

export const Evidence = mongoose.model('Evidence', evidenceSchema);
export default Evidence;
