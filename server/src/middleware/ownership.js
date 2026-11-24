import mongoose from 'mongoose';
import { AssessmentSession } from '../models/AssessmentSession.js';
import { Evidence } from '../models/index.js';
import { Roadmap } from '../models/Roadmap.js';
import { AppError } from './errorHandler.js';

/**
 * Express router.param middleware to validate session ownership
 * Triggered on any route containing :id or :sessionId
 */
export const sessionParamOwnership = async (req, res, next, sessionId) => {
  try {
    const user = req.user;
    if (!user || user.role === 'recruiter' || user.role === 'admin') {
      return next();
    }

    let session = null;
    try {
      const query = AssessmentSession.findById(sessionId);
      if (query && typeof query.select === 'function') {
        const sel = query.select('userId candidateId');
        session = sel && typeof sel.lean === 'function' ? await sel.lean() : await sel;
      } else if (query && typeof query.then === 'function') {
        session = await query;
      }
    } catch (e) {
      // ignore
    }

    if (session) {
      const ownerId = String(session.userId || session.candidateId || '');
      const currentUserId = String(user._id || user.id || '');
      if (ownerId && currentUserId && ownerId !== currentUserId) {
        return next(
          new AppError("Forbidden: You do not have permission to access another candidate's session", 403)
        );
      }
    }

    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Route-level middleware to enforce session ownership
 */
export const requireSessionOwnership = (paramName = 'id') => {
  return async (req, res, next) => {
    const sessionId = req.params[paramName];
    return sessionParamOwnership(req, res, next, sessionId);
  };
};

/**
 * Validates that a candidate only streams evidence belonging to their own session,
 * while recruiters and admins can access any evidence.
 */
export const requireEvidenceOwnership = async (req, res, next) => {
  try {
    const evidenceId = req.params.id;
    const user = req.user;

    if (!user) {
      return next(new AppError('Authentication required', 401));
    }

    if (user.role === 'recruiter' || user.role === 'admin') {
      return next();
    }

    let evidence = null;
    try {
      const query = Evidence.findById(evidenceId);
      if (query && typeof query.select === 'function') {
        const sel = query.select('sessionId');
        evidence = sel && typeof sel.lean === 'function' ? await sel.lean() : await sel;
      } else if (query && typeof query.then === 'function') {
        evidence = await query;
      }
    } catch (e) {}

    if (evidence && evidence.sessionId) {
      let session = null;
      try {
        const sQuery = AssessmentSession.findById(evidence.sessionId);
        if (sQuery && typeof sQuery.select === 'function') {
          const sel = sQuery.select('userId candidateId');
          session = sel && typeof sel.lean === 'function' ? await sel.lean() : await sel;
        } else if (sQuery && typeof sQuery.then === 'function') {
          session = await sQuery;
        }
      } catch (e) {}

      if (session) {
        const ownerId = String(session.userId || session.candidateId || '');
        const currentUserId = String(user._id || user.id || '');
        if (ownerId && currentUserId && ownerId !== currentUserId) {
          return next(
            new AppError("Forbidden: You do not have permission to view another candidate's evidence", 403)
          );
        }
      }
    }

    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Validates that a candidate only modifies their own learning roadmap,
 * while recruiters and admins can modify any.
 */
export const requireRoadmapOwnership = async (req, res, next) => {
  try {
    const roadmapId = req.params.id;
    const user = req.user;

    if (!user) {
      return next(new AppError('Authentication required', 401));
    }

    if (user.role === 'recruiter' || user.role === 'admin') {
      return next();
    }

    let roadmap = null;
    try {
      const query = Roadmap.findById(roadmapId);
      if (query && typeof query.select === 'function') {
        const sel = query.select('candidateId');
        roadmap = sel && typeof sel.lean === 'function' ? await sel.lean() : await sel;
      } else if (query && typeof query.then === 'function') {
        roadmap = await query;
      }
    } catch (e) {}

    if (roadmap && roadmap.candidateId) {
      const ownerId = String(roadmap.candidateId);
      const currentUserId = String(user._id || user.id || '');
      if (ownerId && currentUserId && ownerId !== currentUserId) {
        return next(
          new AppError("Forbidden: You do not have permission to modify another candidate's roadmap", 403)
        );
      }
    }

    next();
  } catch (err) {
    next(err);
  }
};

export default {
  sessionParamOwnership,
  requireSessionOwnership,
  requireEvidenceOwnership,
  requireRoadmapOwnership
};
