import mongoose from 'mongoose';

const resourceSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Resource title is required'],
      trim: true
    },
    skillSlug: {
      type: String,
      required: true,
      index: true
    },
    skillId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Skill',
      default: null
    },
    type: {
      type: String,
      enum: ['video', 'article', 'interactive', 'project', 'doc', 'course', 'book', 'tutorial', 'cheatsheet'],
      default: 'article'
    },
    url: {
      type: String,
      required: true
    },
    provider: {
      type: String,
      default: 'Official Docs'
    },
    difficulty: {
      type: String,
      enum: ['Beginner', 'Intermediate', 'Advanced'],
      default: 'Intermediate'
    },
    estimatedHours: {
      type: Number,
      default: 4
    },
    rating: {
      type: Number,
      default: 4.8
    },
    isOfficial: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

export const Resource = mongoose.model('Resource', resourceSchema);
export default Resource;
