import express from 'express';
import User from '../models/User.js';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  inviteCandidate,
  getRecruiterCandidates,
  generateAIQuestion,
  getQuestionApprovalQueue,
  approveQuestion,
  recalibrateIRT,
  getLeaderboard,
  toggleLeaderboardOptIn,
  createAdminUser
} from '../controllers/adminRecruiterController.js';

const router = express.Router();

router.use(authenticate);

// Saved Resume Persistence (Replaces old resume in DB on new upload)
router.get('/resume', async (req, res, next) => {
  try {
    const user = await User.findById(req.user?.id || req.user?._id).select('profile');
    res.status(200).json({
      success: true,
      data: {
        resumeText: user?.profile?.resumeText || '',
        resumeFileName: user?.profile?.resumeFileName || '',
        resumeUpdatedAt: user?.profile?.resumeUpdatedAt || null,
        savedJDText: user?.profile?.savedJDText || ''
      }
    });
  } catch (err) {
    next(err);
  }
});

router.post('/resume', async (req, res, next) => {
  try {
    const { resumeText = '', resumeFileName = '', savedJDText = '' } = req.body;
    const update = {
      'profile.resumeUpdatedAt': new Date()
    };
    if (resumeText !== undefined) update['profile.resumeText'] = resumeText;
    if (resumeFileName !== undefined) update['profile.resumeFileName'] = resumeFileName;
    if (savedJDText !== undefined) update['profile.savedJDText'] = savedJDText;

    const user = await User.findByIdAndUpdate(
      req.user?.id || req.user?._id,
      { $set: update },
      { new: true }
    ).select('profile');

    res.status(200).json({
      success: true,
      message: 'Resume saved and replaced successfully in database',
      data: {
        resumeText: user?.profile?.resumeText || '',
        resumeFileName: user?.profile?.resumeFileName || '',
        resumeUpdatedAt: user?.profile?.resumeUpdatedAt || null,
        savedJDText: user?.profile?.savedJDText || ''
      }
    });
  } catch (err) {
    next(err);
  }
});

// Gamification & Leaderboard
router.get('/leaderboard', getLeaderboard);
router.post('/leaderboard/toggle', toggleLeaderboardOptIn);

// Recruiter Portal Endpoints
router.get('/recruiter/candidates', authorize('recruiter', 'admin'), getRecruiterCandidates);
router.post('/recruiter/invite', authorize('recruiter', 'admin'), inviteCandidate);

// Admin Question Generation, Approval & Recalibration Endpoints
router.post('/admin/create-user', authorize('admin'), createAdminUser);
router.get('/admin/approval-queue', authorize('admin'), getQuestionApprovalQueue);
router.post('/admin/generate-question', authorize('admin'), generateAIQuestion);
router.post('/admin/questions/:id/approve', authorize('admin'), approveQuestion);
router.post('/admin/recalibrate-irt', authorize('admin'), recalibrateIRT);

export default router;