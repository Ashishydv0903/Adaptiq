import mongoose from 'mongoose';

const skillSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Skill name is required'],
      trim: true
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    category: {
      type: String,
      required: true,
      enum: ['Frontend', 'Backend', 'Database', 'DevOps', 'System Design', 'Data & AI', 'Behavioral', 'Security', 'Architecture', 'Cloud']
    },
    description: {
      type: String,
      default: ''
    },
    prerequisites: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Skill'
      }
    ],
    parentSkillId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Skill',
      default: null
    },
    weight: {
      type: Number,
      default: 1.0
    }
  },
  {
    timestamps: true
  }
);

export const Skill = mongoose.model('Skill', skillSchema);
export default Skill;
