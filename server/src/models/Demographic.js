import mongoose from 'mongoose';

const demographicSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },
    gender: {
      type: String,
      enum: ['female', 'male', 'non_binary', 'transgender', 'other', 'prefer_not_to_say'],
      default: 'prefer_not_to_say'
    },
    ethnicity: {
      type: String,
      enum: [
        'asian',
        'black',
        'hispanic_latino',
        'white',
        'indigenous',
        'middle_eastern',
        'multiracial',
        'other',
        'prefer_not_to_say'
      ],
      default: 'prefer_not_to_say'
    },
    ageGroup: {
      type: String,
      enum: ['18-24', '25-34', '35-44', '45-54', '55+', 'prefer_not_to_say'],
      default: 'prefer_not_to_say'
    },
    disabilityStatus: {
      type: String,
      enum: ['yes', 'no', 'prefer_not_to_say'],
      default: 'prefer_not_to_say'
    },
    veteranStatus: {
      type: String,
      enum: ['yes', 'no', 'prefer_not_to_say'],
      default: 'prefer_not_to_say'
    },
    consentGiven: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

export const Demographic = mongoose.model('Demographic', demographicSchema);
export default Demographic;