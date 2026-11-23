import mongoose from 'mongoose';

const responseEvaluationSchema = new mongoose.Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AssessmentSession',
      required: true
    },
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question',
      required: true
    },
    candidateAnswer: {
      type: String,
      required: true
    },
    score: {
      type: Number,
      required: true // 0 to 100
    },
    rawScore: {
      type: Number,
      default: 0
    },
    promptVersion: {
      type: String,
      default: 'v1.0.0'
    },
    model: {
      type: String,
      default: 'gemini-1.5-flash'
    },
    variance: {
      type: Number,
      default: 0
    },
    rubricScores: {
      correctness: { type: Number, default: 5 },
      depth: { type: Number, default: 5 },
      clarity: { type: Number, default: 5 },
      completeness: { type: Number, default: 5 },
      relevance: { type: Number, default: 5 },
      // Backward compatibility with initial schema
      technicalAccuracy: { type: Number, default: 5 },
      conceptualDepth: { type: Number, default: 5 },
      communication: { type: Number, default: 5 },
      codeEfficiency: { type: Number, default: 5 },
      problemSolving: { type: Number, default: 5 }
    },
    rubricDetails: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    conceptCoverage: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    features: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    // Explainable AI: Feature Attributions via Linear SHAP & Kernel SHAP
    shap: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    shapAttributions: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    // Counterfactual recommendations
    counterfactuals: [
      {
        concept: String,
        currentStatus: String,
        potentialGain: Number,
        simulatedScore: Number,
        currentScore: Number,
        recommendation: String,
        explanation: String,
        dimension: String
      }
    ],
    semanticSimilarity: {
      type: Number,
      default: 0
    },
    integrityMultiplier: {
      type: Number,
      default: 1.0
    },
    judge0Result: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    modelAnswerDiff: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    feedback: {
      strengths: [{ type: String }],
      improvements: [{ type: String }],
      modelAnswerDiff: { type: String, default: '' },
      summary: { type: String, default: '' }
    }
  },
  {
    timestamps: true
  }
);

export const ResponseEvaluation = mongoose.model('ResponseEvaluation', responseEvaluationSchema);
export default ResponseEvaluation;
