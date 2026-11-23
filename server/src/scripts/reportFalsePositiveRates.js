#!/usr/bin/env node
/**
 * @file reportFalsePositiveRates.js
 * CLI Script: Reports per-event-type false-positive rates to tune proctoring thresholds.
 * Run with: npm run report:false-positives or node src/scripts/reportFalsePositiveRates.js
 */

import mongoose from 'mongoose';
import { calculateFalsePositiveRates } from '../services/proctor/tuningReport.js';
import { connectDB } from '../config/db.js';
import { logger } from '../config/logger.js';

async function main() {
  console.log('\n===============================================================');
  console.log('   AdaptIQ AI Proctoring: False-Positive & Threshold Tuning Report');
  console.log('===============================================================\n');

  try {
    await connectDB().catch(() => {
      console.log('ℹ️ Operating in benchmark fallback mode (DB connection deferred).\n');
    });

    const report = await calculateFalsePositiveRates();

    console.log(`Audited Sessions : ${report.totalSessionsAudited}`);
    console.log(`Events Analyzed  : ${report.totalEventsAnalyzed}`);
    console.log(`Aggregate FPR    : ${report.aggregateFalsePositiveRate}%\n`);

    console.log('Per-Event-Type False-Positive Breakdown:');
    console.log('---------------------------------------------------------------');

    console.table(
      report.events.map((e) => ({
        'Event Type': e.type,
        Occurrences: e.totalOccurrences,
        Confirmed: e.confirmedViolations,
        Dismissed: e.dismissedFalsePositives,
        'FPR (%)': `${e.falsePositiveRate}%`,
        Action: e.tuningAction
      }))
    );

    console.log('\nThreshold Tuning Recommendations:');
    console.log('---------------------------------------------------------------');
    report.events.forEach((e) => {
      if (e.falsePositiveRate > 15) {
        console.log(`• [${e.type}] ${e.recommendation}`);
      }
    });

    console.log('\n✅ Report complete. Thresholds can be configured in src/config/proctorConfig.js.\n');
  } catch (err) {
    logger.error(`Error generating false positive tuning report: ${err.message}`);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
    process.exit(0);
  }
}

main();
