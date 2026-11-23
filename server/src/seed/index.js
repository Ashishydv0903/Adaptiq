import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { User, Skill, Question, Resource } from '../models/index.js';
import { comprehensiveSkills } from './skillsData.js';
import { sampleResources } from './sampleResources.js';
import { allQuestions } from './questions/allQuestions.js';
import { sampleUsers } from './sampleUsers.js';

export const seedDatabase = async () => {
  try {
    logger.info('🌱 Starting AdaptIQ database seed (80+ skills & 150+ questions)...');
    await mongoose.connect(env.MONGO_URI);
    logger.info(`Connected to DB: ${env.MONGO_URI}`);

    // Clear existing collections
    await User.deleteMany({});
    await Skill.deleteMany({});
    await Question.deleteMany({});
    await Resource.deleteMany({});
    logger.info('Cleared existing Users, Skills, Questions, and Resources');

    // 1. Seed 80+ Skills
    const skillsToInsert = comprehensiveSkills.map(({ prerequisites, ...rest }) => ({
      ...rest,
      prerequisites: []
    }));
    const createdSkills = await Skill.insertMany(skillsToInsert);
    logger.info(`✅ Seeded ${createdSkills.length} comprehensive skills across 7 categories`);

    const skillMap = new Map();
    for (const skill of createdSkills) {
      skillMap.set(skill.slug, skill._id);
    }

    // Update prerequisite ObjectIds
    for (const skill of comprehensiveSkills) {
      if (skill.prerequisites && skill.prerequisites.length > 0) {
        const prereqIds = skill.prerequisites
          .map((slug) => skillMap.get(slug))
          .filter(Boolean);

        if (prereqIds.length > 0) {
          await Skill.updateOne(
            { slug: skill.slug },
            { $set: { prerequisites: prereqIds } }
          );
        }
      }
    }
    logger.info('✅ Populated prerequisite DAG relationships for 80+ skills');

    // 2. Seed Admin-Maintained Learning Resources
    const resourcesToInsert = sampleResources.map((r) => ({
      ...r,
      skillId: skillMap.get(r.skillSlug) || null
    }));
    const createdResources = await Resource.insertMany(resourcesToInsert);
    logger.info(`✅ Seeded ${createdResources.length} curated admin learning resources`);

    // 3. Seed Questions with mapped Skill ObjectIds
    const questionsToInsert = allQuestions.map((q) => {
      const skillId = skillMap.get(q.skillSlug);
      const { skillSlug, ...rest } = q;
      return {
        ...rest,
        skills: skillId ? [skillId] : []
      };
    });

    const createdQuestions = await Question.insertMany(questionsToInsert);
    logger.info(`✅ Seeded ${createdQuestions.length} comprehensive questions across 5 role tracks:`);
    const trackCounts = createdQuestions.reduce((acc, q) => {
      acc[q.track] = (acc[q.track] || 0) + 1;
      return acc;
    }, {});
    console.table(trackCounts);

    // 4. Seed Users (passwords hashed via pre-save hook)
    for (const u of sampleUsers) {
      await User.create(u);
    }
    logger.info(`✅ Seeded ${sampleUsers.length} default users (Admin, Recruiter, Candidate)`);

    logger.info('🎉 AdaptIQ Database seeding completed successfully!');
    if (process.argv[1] && process.argv[1].endsWith('index.js')) {
      await mongoose.disconnect();
      process.exit(0);
    }
    return {
      skillsCount: createdSkills.length,
      resourcesCount: createdResources.length,
      questionsCount: createdQuestions.length,
      usersCount: sampleUsers.length
    };
  } catch (error) {
    logger.error(`❌ Seeding failed: ${error.message}`);
    if (process.argv[1] && process.argv[1].endsWith('index.js')) {
      await mongoose.disconnect();
      process.exit(1);
    }
    throw error;
  }
};

if (process.argv[1] && process.argv[1].endsWith('index.js')) {
  seedDatabase();
}

export default seedDatabase;
