import mongoose from 'mongoose';

const reviewQueueItemSchema = new mongoose.Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AssessmentSession',
      required: true,
      index: true
    },
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question',
      required: true
    },
    candidateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    candidateName: {
      type: String,
      default: 'Candidate'
    },
    triggerReason: {
      type: String,
      enum: [
        'LOW_AI_CONFIDENCE',
        'INTEGRITY_ANOMALY',
        'DIF_QUARANTINE',
        'BORDERLINE_SCORE',
        'CANDIDATE_DISPUTE'
      ],
      required: true
    },
    severity: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'MEDIUM'
    },
    originalScore: {
      type: Number,
      required: true
    },
    confidenceScore: {
      type: Number,
      default: 0.65
    },
    candidateAnswer: {
      type: String,
      default: ''
    },
    rubricEvidence: [
      {
        type: String
      }
    ],
    status: {
      type: String,
      enum: ['pending', 'in_review', 'approved', 'overridden', 'dismissed'],
      default: 'pending',
      index: true
    },
    assignedReviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    overriddenScore: {
      type: Number,
      default: null
    },
    recruiterNotes: {
      type: String,
      default: ''
    },
    resolvedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

export const ReviewQueueItem = mongoose.model('ReviewQueueItem', reviewQueueItemSchema);
export default ReviewQueueItem;