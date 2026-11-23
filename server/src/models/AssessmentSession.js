import mongoose from 'mongoose';

const assessmentSessionSchema = new mongoose.Schema(
  {
    candidateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    track: {
      type: String,
      required: true,
      enum: ['frontend', 'backend', 'fullstack', 'devops', 'datascience']
    },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'paused', 'completed', 'flagged', 'reviewed', 'terminated'],
      default: 'pending'
    },
    // Recruiter Proctoring Controls & Policy
    onRedPolicy: {
      type: String,
      enum: ['continue', 'pause', 'terminate'],
      default: 'pause'
    },
    isProctored: {
      type: Boolean,
      default: false
    },
    recruiterNotes: [
      {
        note: { type: String, required: true },
        authorEmail: { type: String, default: 'recruiter@adaptiq.ai' },
        authorRole: { type: String, default: 'recruiter' },
        createdAt: { type: Date, default: Date.now }
      }
    ],
    // Targeted Resume + JD Interview Customization
    isTargeted: {
      type: Boolean,
      default: false
    },
    targetRole: {
      type: String,
      default: ''
    },
    targetCompany: {
      type: String,
      default: ''
    },
    resumeHighlights: [
      { type: String }
    ],
    jdRequirements: [
      { type: String }
    ],
    customQuestions: [
      { type: mongoose.Schema.Types.Mixed }
    ],
    // Multi-round progression sequence
    rounds: [
      {
        roundType: {
          type: String,
          enum: ['mcq', 'technical', 'coding', 'system_design', 'behavioral', 'voice', 'hr'],
          required: true
        },
        label: { type: String, default: '' },
        status: {
          type: String,
          enum: ['pending', 'in_progress', 'completed', 'skipped'],
          default: 'pending'
        },
        targetQuestions: { type: Number, default: 2 },
        completedQuestions: { type: Number, default: 0 },
        defaultTimerSeconds: { type: Number, default: 180 },
        score: { type: Number, default: 0 }
      }
    ],
    currentRoundIndex: {
      type: Number,
      default: 0
    },
    currentRound: {
      type: String,
      enum: ['mcq', 'technical', 'coding', 'system_design', 'behavioral', 'voice', 'hr'],
      default: 'mcq'
    },
    currentQuestionIndex: {
      type: Number,
      default: 0
    },
    totalQuestions: {
      type: Number,
      default: 8
    },
    // Server-validated timer tracking
    currentQuestionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question'
    },
    currentQuestionStartedAt: {
      type: Date,
      default: Date.now
    },
    currentQuestionAllowedSeconds: {
      type: Number,
      default: 90
    },
    pausedAt: {
      type: Date,
      default: null
    },
    totalPausedSeconds: {
      type: Number,
      default: 0
    },
    // Real-time IRT Latent Ability estimation
    abilityTheta: {
      type: Number,
      default: 0.0
    },
    abilitySem: {
      type: Number,
      default: 1.0
    },
    percentileScore: {
      type: Number,
      default: 50.0
    },
    responses: [
      {
        questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
        roundType: { type: String, required: true },
        answer: { type: String, default: '' },
        score: { type: Number, default: 0 },
        thetaAfter: { type: Number, default: 0 },
        semAfter: { type: Number, default: 1 },
        answeredAt: { type: Date, default: Date.now },
        durationSeconds: { type: Number, default: 0 },
        serverValidatedTimer: {
          allowedSeconds: { type: Number, default: 90 },
          actualSeconds: { type: Number, default: 0 },
          timeExpired: { type: Boolean, default: false }
        },
        // LLM Follow-ups (max 2 per question)
        followUps: [
          {
            type: {
              type: String,
              enum: ['clarify', 'go_deeper', 'edge_case', 'real_world_example', 'trade_off'],
              required: true
            },
            followUpPrompt: { type: String, required: true },
            contextRationale: { type: String, default: '' },
            expectedFocus: { type: String, default: '' },
            candidateAnswer: { type: String, default: '' },
            score: { type: Number, default: null },
            answeredAt: { type: Date, default: null }
          }
        ],
        // STAR Evaluation for behavioral responses
        starEvaluation: {
          type: mongoose.Schema.Types.Mixed,
          default: null
        },
        // Coding round execution & review
        codeExecution: {
          type: mongoose.Schema.Types.Mixed,
          default: null
        },
        codeReview: {
          type: mongoose.Schema.Types.Mixed,
          default: null
        },
        hintsUnlocked: [
          {
            level: { type: Number, required: true },
            penaltyPoints: { type: Number, default: 2 },
            unlockedAt: { type: Date, default: Date.now }
          }
        ],
        // Dual-input answer telemetry (Type + Speak)
        inputMode: {
          type: String,
          enum: ['type', 'speak', 'hybrid'],
          default: 'type'
        },
        transcript: {
          type: String,
          default: ''
        },
        audioUrl: {
          type: String,
          default: ''
        },
        editedAfterTranscription: {
          type: Boolean,
          default: false
        },
        speechMetrics: {
          type: mongoose.Schema.Types.Mixed,
          default: null
        },
        spokenExplanation: {
          type: mongoose.Schema.Types.Mixed,
          default: null
        },
        // Voice mode transcription and delivery metrics
        voiceMetrics: {
          type: mongoose.Schema.Types.Mixed,
          default: null
        },
        // Optional consent-gated confidence trend (EXCLUDED from scoring)
        confidenceTrend: [
          {
            timestamp: { type: Number },
            confidence: { type: Number }
          }
        ],
        // AI Evaluation Confidence & Human Review Flag
        confidenceScore: {
          type: Number,
          default: 0.85
        },
        reviewStatus: {
          type: String,
          enum: ['not_flagged', 'flagged_review', 'overridden'],
          default: 'not_flagged'
        }
      }
    ],
    // AI Proctoring Enrolment & Events
    proctoringEnrolment: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    proctoringEvents: [
      {
        type: mongoose.Schema.Types.Mixed
      }
    ],
    integrityEvents: [
      {
        eventType: {
          type: String,
          required: true
        },
        severity: {
          type: String,
          enum: ['INFO', 'WARNING', 'CRITICAL'],
          default: 'WARNING'
        },
        scoreDeduction: {
          type: Number,
          default: 0
        },
        timestamp: { type: Date, default: Date.now },
        metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
      }
    ],
    integrityScore: {
      type: Number,
      default: 100 // 0 to 100
    },
    integrityStatus: {
      type: String,
      enum: ['GREEN', 'YELLOW', 'ORANGE', 'RED'],
      default: 'GREEN'
    },
    // Real-Time Integrity Metrics & Trust Score Breakdown
    integrityMetrics: {
      facePresencePct: { type: Number, default: 100 },
      focusRetentionPct: { type: Number, default: 100 },
      tabSwitchCount: { type: Number, default: 0 },
      cameraAvailable: { type: Boolean, default: true },
      micAvailable: { type: Boolean, default: true },
      trustScore: { type: Number, default: 100 },
      trustDeductions: [
        {
          reason: { type: String, required: true },
          points: { type: Number, required: true },
          timestamp: { type: Date, default: Date.now }
        }
      ],
      isEarlyExit: { type: Boolean, default: false }
    },
    // Granular Chronological Audit Log
    auditLog: [
      {
        eventType: { type: String, required: true },
        severity: { type: String, default: 'INFO' },
        durationMs: { type: Number, default: 0 },
        deduction: { type: Number, default: 0 },
        timestamp: { type: Date, default: Date.now },
        metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
      }
    ],
    startedAt: {
      type: Date,
      default: Date.now
    },
    completedAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

export const AssessmentSession = mongoose.model('AssessmentSession', assessmentSessionSchema);
export default AssessmentSession;
