import mongoose from 'mongoose';

const roadmapSchema = new mongoose.Schema(
  {
    candidateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    targetRole: {
      type: String,
      required: true
    },
    matchPercentage: {
      type: Number,
      required: true
    },
    skillGaps: [
      {
        skillId: { type: mongoose.Schema.Types.ObjectId, ref: 'Skill' },
        skillName: { type: String, required: true },
        currentMastery: { type: Number, required: true },
        requiredLevel: { type: Number, required: true },
        gap: { type: Number, required: true },
        priority: { type: String, enum: ['Low', 'Medium', 'Critical'], default: 'Medium' }
      }
    ],
    milestones: [
      {
        title: { type: String, required: true },
        description: { type: String, required: true },
        durationWeeks: { type: Number, default: 2 },
        skillsTargeted: [{ type: String }],
        resources: [
          {
            title: { type: String, required: true },
            type: { type: String, enum: ['video', 'article', 'interactive', 'project', 'doc'], default: 'article' },
            url: { type: String, required: true },
            difficulty: { type: String, default: 'Intermediate' }
          }
        ]
      }
    ]
  },
  {
    timestamps: true
  }
);

export const Roadmap = mongoose.model('Roadmap', roadmapSchema);
export default Roadmap;
