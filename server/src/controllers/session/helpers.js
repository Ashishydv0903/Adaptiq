import mongoose from 'mongoose';
import { Question, Skill } from '../../models/index.js';
import { allQuestions } from '../../seed/questions/allQuestions.js';
import { sampleSkills } from '../../seed/sampleSkills.js';
import { getSanitizedHintLadder } from '../../services/scoring/hintLadder.js';

/**
 * Strips confidential evaluation benchmarks (ideal answers, isCorrect flags, hidden test cases) before sending to client
 */
export const sanitizeQuestionForCandidate = (question, unlockedHints = []) => {
  if (!question) return null;
  const qObj = question.toObject ? question.toObject() : { ...question };
  delete qObj.idealAnswer;
  if (qObj.options && Array.isArray(qObj.options)) {
    qObj.options = qObj.options.map(({ text }) => ({ text }));
  }
  // Expose only visible test cases to candidate
  if (qObj.testCases && Array.isArray(qObj.testCases)) {
    qObj.testCases = qObj.testCases
      .filter((tc) => !tc.isHidden)
      .map(({ input, expectedOutput, explanation }) => ({ input, expectedOutput, explanation }));
  }
  // Sanitize hint ladder (hide text for locked levels)
  qObj.hints = getSanitizedHintLadder(qObj, unlockedHints);
  return qObj;
};

/**
 * Ensures question bank is populated; auto-seeds from allQuestions if collection is empty
 */
export const getOrSeedQuestionPool = async (track) => {
  let questionPool = [];

  try {
    questionPool = await Question.find({ track, status: 'active' });
  } catch (err) {
    questionPool = [];
  }

  // If questions were found (e.g. from DB or test mock), return them immediately
  if (questionPool && questionPool.length > 0) {
    return questionPool;
  }

  // If DB is connected and empty, auto-seed
  if (mongoose.connection.readyState === 1) {
    try {
      const skillCount = await Skill.countDocuments().catch(() => 0);
      if (skillCount === 0) {
        await Skill.insertMany(sampleSkills).catch(() => {});
      }

      const skills = await Skill.find().catch(() => []);
      const skillMap = new Map();
      for (const s of skills) {
        skillMap.set(s.slug, s._id);
      }

      const toInsert = allQuestions.map((q) => {
        const skillId = skillMap.get(q.skillSlug);
        const { skillSlug, ...rest } = q;
        return {
          ...rest,
          skills: skillId ? [skillId] : [],
          status: 'active'
        };
      });

      await Question.insertMany(toInsert);
      questionPool = await Question.find({ track, status: 'active' });
      if (questionPool && questionPool.length > 0) {
        return questionPool;
      }
    } catch (err) {
      // Ignore and fallback
    }
  }

  // Fallback to in-memory question bank
  return allQuestions
    .filter((q) => q.track === track)
    .map((q, idx) => ({
      ...q,
      _id: `mem_q_${track}_${idx}`,
      id: `mem_q_${track}_${idx}`
    }));
};
