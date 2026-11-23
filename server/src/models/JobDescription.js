import mongoose from 'mongoose';

const jobDescriptionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Job title is required'],
      trim: true
    },
    company: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true
    },
    track: {
      type: String,
      required: true,
      enum: ['frontend', 'backend', 'fullstack', 'devops', 'datascience']
    },
    description: {
      type: String,
      required: true
    },
    requiredSkills: [
      {
        skillId: { type: mongoose.Schema.Types.ObjectId, ref: 'Skill' },
        skillName: { type: String, required: true },
        minProficiency: { type: Number, default: 0.7 }, // 0.0 to 1.0
        weight: { type: Number, default: 1.0 }
      }
    ],
    experienceLevel: {
      type: String,
      enum: ['entry', 'mid', 'senior', 'lead'],
      default: 'mid'
    },
    embeddings: [
      {
        type: Number
      }
    ]
  },
  {
    timestamps: true
  }
);

export const JobDescription = mongoose.model('JobDescription', jobDescriptionSchema);
export default JobDescription;
