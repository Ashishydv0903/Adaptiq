import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Question title is required'],
      trim: true
    },
    prompt: {
      type: String,
      required: [true, 'Question prompt is required']
    },
    track: {
      type: String,
      required: true,
      enum: ['frontend', 'backend', 'fullstack', 'devops', 'datascience']
    },
    roundType: {
      type: String,
      required: true,
      enum: ['mcq', 'technical', 'coding', 'system_design', 'behavioral', 'voice', 'hr']
    },
    difficultyLevel: {
      type: String,
      required: true,
      enum: ['easy', 'medium', 'hard', 'expert'],
      default: 'medium'
    },
    // Item Response Theory parameters
    irtParams: {
      a: { type: Number, default: 1.0 }, // Discrimination
      b: { type: Number, default: 0.0 }, // Difficulty
      c: { type: Number, default: 0.0 }  // Pseudo-guessing
    },
    skills: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Skill'
      }
    ],
    // For MCQ questions
    options: [
      {
        text: { type: String, required: true },
        isCorrect: { type: Boolean, required: true },
        explanation: { type: String, default: '' }
      }
    ],
    // For Coding questions
    codeStub: {
      language: { type: String, default: 'javascript' },
      starterCode: { type: String, default: '' },
      solutionTemplate: { type: String, default: '' }
    },
    starterCodes: {
      javascript: { type: String, default: '' },
      python: { type: String, default: '' },
      java: { type: String, default: '' },
      cpp: { type: String, default: '' }
    },
    testCases: [
      {
        input: { type: String, default: '' },
        expectedOutput: { type: String, default: '' },
        isHidden: { type: Boolean, default: false },
        explanation: { type: String, default: '' }
      }
    ],
    // 3-Level Costed Hint Ladder
    hints: [
      {
        level: { type: Number, required: true }, // 1, 2, or 3
        hintText: { type: String, required: true },
        penaltyPoints: { type: Number, default: 2 }
      }
    ],
    // Mentor benchmark answer for explainable diffs
    idealAnswer: {
      type: String,
      required: [true, 'Ideal benchmark answer is required for Explainable AI comparison']
    },
    // Evaluation rubric weights
    rubricWeights: {
      technicalAccuracy: { type: Number, default: 0.35 },
      conceptualDepth: { type: Number, default: 0.20 },
      communication: { type: Number, default: 0.15 },
      codeEfficiency: { type: Number, default: 0.15 },
      problemSolving: { type: Number, default: 0.15 }
    },
    // Fairness DIF status
    status: {
      type: String,
      enum: ['active', 'quarantined', 'review'],
      default: 'active'
    },
    difStats: {
      deltaMH: { type: Number, default: 0 },
      alphaMH: { type: Number, default: 1.0 },
      category: { type: String, enum: ['A', 'B', 'C'], default: 'A' },
      pValue: { type: Number, default: 1.0 },
      sampleSize: { type: Number, default: 0 },
      lastEvaluated: { type: Date, default: null }
    }
  },
  {
    timestamps: true
  }
);

export const Question = mongoose.model('Question', questionSchema);
export default Question;
