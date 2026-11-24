import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { AppError } from '../middleware/errorHandler.js';
import { env } from '../config/env.js';

/**
 * Helper to generate tokens and attach refresh token to user
 */
const createAndSendTokens = async (user, statusCode, res, message = 'Success') => {
  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();

  // Save refresh token to user document
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  user.refreshTokens.push({ token: refreshToken, expiresAt });
  await user.save({ validateBeforeSave: false });

  // Clean user object
  const userResponse = {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    profile: user.profile,
    demographicGroup: user.demographicGroup
  };

  res.status(statusCode).json({
    success: true,
    message,
    data: {
      user: userResponse,
      accessToken,
      refreshToken
    }
  });
};

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Public
 */
export const register = async (req, res, next) => {
  try {
    const { name, email, password, demographicGroup } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return next(new AppError('An account with this email already exists', 409));
    }

    // Public registration MUST ignore any role provided in the request body and always create a candidate
    const user = await User.create({
      name,
      email,
      password,
      role: 'candidate',
      demographicGroup: demographicGroup || 'unspecified'
    });

    await createAndSendTokens(user, 201, res, 'User registered successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Login user
 * @route   POST /api/auth/login
 * @access  Public
 */
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return next(new AppError('Invalid email or password', 401));
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return next(new AppError('Invalid email or password', 401));
    }

    await createAndSendTokens(user, 200, res, 'Login successful');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Refresh access token
 * @route   POST /api/auth/refresh
 * @access  Public
 */
export const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken: incomingToken } = req.body;

    // Verify refresh token signature
    let decoded;
    try {
      decoded = jwt.verify(incomingToken, env.JWT_REFRESH_SECRET);
    } catch (err) {
      return next(new AppError('Invalid or expired refresh token. Please log in again.', 401));
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return next(new AppError('User not found', 401));
    }

    // Check if refresh token exists in user's saved tokens
    const tokenIndex = user.refreshTokens.findIndex((t) => t.token === incomingToken);
    if (tokenIndex === -1) {
      return next(new AppError('Refresh token revoked or invalid', 401));
    }

    // Rotate refresh token: remove old, generate new
    const newAccessToken = user.generateAccessToken();
    const newRefreshToken = user.generateRefreshToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Atomic update to avoid Mongoose VersionError on concurrent requests
    await User.findByIdAndUpdate(user._id, {
      $pull: { refreshTokens: { token: incomingToken } },
      $push: { refreshTokens: { token: newRefreshToken, expiresAt } }
    }).catch(async () => {
      user.refreshTokens = user.refreshTokens.filter((t) => t.token !== incomingToken);
      user.refreshTokens.push({ token: newRefreshToken, expiresAt });
      await user.save({ validateBeforeSave: false }).catch(() => {});
    });

    res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Logout user (revoke refresh token)
 * @route   POST /api/auth/logout
 * @access  Private
 */
export const logout = async (req, res, next) => {
  try {
    const { refreshToken: incomingToken } = req.body;
    if (incomingToken && req.user) {
      req.user.refreshTokens = req.user.refreshTokens.filter((t) => t.token !== incomingToken);
      await req.user.save({ validateBeforeSave: false });
    }

    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get currently logged in user profile
 * @route   GET /api/auth/me
 * @access  Private
 */
export const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    res.status(200).json({
      success: true,
      data: {
        user
      }
    });
  } catch (error) {
    next(error);
  }
};
