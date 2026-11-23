import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide a name'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters']
    },
    email: {
      type: String,
      required: [true, 'Please provide an email address'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        'Please provide a valid email'
      ]
    },
    password: {
      type: String,
      required: [true, 'Please provide a password'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false
    },
    role: {
      type: String,
      enum: ['candidate', 'recruiter', 'admin'],
      default: 'candidate'
    },
    demographicGroup: {
      type: String,
      default: 'unspecified'
    },
    profile: {
      headline: { type: String, default: '' },
      targetRole: { type: String, default: 'Fullstack Engineer' },
      resumeUrl: { type: String, default: '' },
      resumeText: { type: String, default: '' },
      resumeFileName: { type: String, default: '' },
      resumeUpdatedAt: { type: Date, default: null },
      savedJDText: { type: String, default: '' },
      skills: [
        {
          skillId: { type: mongoose.Schema.Types.ObjectId, ref: 'Skill' },
          skillName: { type: String },
          mastery: { type: Number, default: 0.2 },
          lastAssessed: { type: Date, default: Date.now }
        }
      ]
    },
    refreshTokens: [
      {
        token: { type: String, required: true },
        expiresAt: { type: Date, required: true },
        createdAt: { type: Date, default: Date.now }
      }
    ]
  },
  {
    timestamps: true
  }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Generate Access Token (JWT)
userSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    {
      id: this._id,
      email: this.email,
      role: this.role,
      name: this.name
    },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );
};

// Generate Refresh Token (JWT)
userSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    {
      id: this._id,
      type: 'refresh'
    },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRES_IN }
  );
};

export const User = mongoose.model('User', userSchema);
export default User;
