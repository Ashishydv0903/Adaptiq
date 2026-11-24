/**
 * @file Recompute Embeddings for Questions and Skills
 * Iterates through all questions and skills in the database,
 * recomputes embeddings with the configured model (GEMINI_EMBEDDING_MODEL),
 * stores vector, model name, and dimension, and saves to MongoDB.
 */

import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { Question } from '../models/Question.js';
import { Skill } from '../models/Skill.js';
import { generateEmbeddingWithMetadata } from '../services/llm/index.js';

/**
 * Re-embeds all Question and Skill records in the database
 *
 * @param {Object} [options]
 * @param {string} [options.targetModel] - Model override
 * @returns {Promise<{ questionCount: number, skillCount: number, embeddingModel: string }>}
 */
export async function reembedAllDocuments(options = {}) {
  const embeddingModel =
    options.targetModel ||
    (env.GEMINI_API_KEY ? env.GEMINI_EMBEDDING_MODEL : 'local-deterministic-64');

  logger.info(`🔄 Starting re-embedding task using model: ${embeddingModel}...`);

  // 1. Re-embed all questions
  const questions = await Question.find({});
  let questionCount = 0;
  for (const q of questions) {
    const textToEmbed = `${q.title}. ${q.prompt}. ${q.idealAnswer || ''}`.trim();
    const embData = await generateEmbeddingWithMetadata(textToEmbed);
    q.embedding = {
      vector: embData.vector,
      model: embData.model,
      embeddingModel: embData.model,
      dimension: embData.dimension,
      updatedAt: new Date()
    };
    await q.save();
    questionCount++;
  }
  logger.info(`✅ Re-embedded ${questionCount} questions with model ${embeddingModel}.`);

  // 2. Re-embed all skills
  const skills = await Skill.find({});
  let skillCount = 0;
  for (const s of skills) {
    const textToEmbed = `${s.name}. ${s.description || ''} ${s.category || ''}`.trim();
    const embData = await generateEmbeddingWithMetadata(textToEmbed);
    s.embedding = {
      vector: embData.vector,
      model: embData.model,
      embeddingModel: embData.model,
      dimension: embData.dimension,
      updatedAt: new Date()
    };
    await s.save();
    skillCount++;
  }
  logger.info(`✅ Re-embedded ${skillCount} skills with model ${embeddingModel}.`);

  return { questionCount, skillCount, embeddingModel };
}

// Allow CLI execution: node src/scripts/reembed.js
if (process.argv[1] && process.argv[1].endsWith('reembed.js')) {
  (async () => {
    try {
      await mongoose.connect(env.MONGO_URI);
      logger.info('Connected to MongoDB for re-embedding.');
      const result = await reembedAllDocuments();
      logger.info(
        `Re-embedding complete: ${result.questionCount} questions, ${result.skillCount} skills.`
      );
      await mongoose.disconnect();
      process.exit(0);
    } catch (err) {
      logger.error(`Re-embedding script failed: ${err.message}`);
      process.exit(1);
    }
  })();
}

export default reembedAllDocuments;
