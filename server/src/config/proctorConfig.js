/**
 * @file Proctoring Configuration & Escalation Rules Engine
 * Configurable thresholds for AI proctoring, event severities, and multi-strike escalation.
 * Sourced from shared canonical proctorConfig.json.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rawConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'proctorConfig.json'), 'utf-8'));

export const { proctorConfigs, SEVERITY_BASE_DEDUCTIONS, EVENT_BASE_DEDUCTIONS } = rawConfig;

/**
 * Computes a time-decayed integrity score (0-100) per session and assigns integrityStatus.
 * Recent events carry full weight; older infractions decay smoothly based on configurable half-life.
 *
 * Status thresholds:
 * - GREEN: score >= 85 and no RED infractions
 * - YELLOW: 70 <= score < 85 and no RED infractions
 * - ORANGE: 50 <= score < 70 and no RED infractions
 * - RED: score < 50 or any escalated RED infraction
 *
 * @param {Array<Object>} events - Array of proctoring events
 * @param {Date|string|number} [currentTime=new Date()] - Reference time for decay calculation
 * @param {Object} [configs=proctorConfigs] - Proctoring configurations
 * @returns {{ integrityScore: number, integrityStatus: 'GREEN'|'YELLOW'|'ORANGE'|'RED', totalDeductions: number, hasRedInfraction: boolean }}
 */
export function calculateTimeDecayedIntegrityScore(events = [], currentTime = new Date(), configs = proctorConfigs) {
  const refTime = new Date(currentTime).getTime();
  const halfLifeMs = (configs.thresholds.timeDecay?.halfLifeMinutes || 15) * 60 * 1000;
  const decayConstant = Math.LN2 / halfLifeMs;

  let totalDecayedDeductions = 0;
  let hasRedInfraction = false;

  for (const ev of events) {
    const sev = ev.severity || 'yellow';
    if (sev === 'red') {
      hasRedInfraction = true;
    }

    const typeKey = (ev.type || '').toUpperCase();
    const baseDeduction = EVENT_BASE_DEDUCTIONS[typeKey] ?? SEVERITY_BASE_DEDUCTIONS[sev] ?? 3;

    const eventTime = ev.timestamp ? new Date(ev.timestamp).getTime() : refTime;
    const elapsedMs = Math.max(0, refTime - eventTime);

    // Exponential time decay: w = exp(-lambda * elapsed)
    const decayWeight = Math.exp(-decayConstant * elapsedMs);
    totalDecayedDeductions += baseDeduction * decayWeight;
  }

  const rawScore = (configs.thresholds.timeDecay?.initialScore || 100) - totalDecayedDeductions;
  const integrityScore = Math.max(0, Math.min(100, Math.round(rawScore)));

  let integrityStatus = 'GREEN';
  if (hasRedInfraction || integrityScore < 50) {
    integrityStatus = 'RED';
  } else if (integrityScore < 70) {
    integrityStatus = 'ORANGE';
  } else if (integrityScore < 85) {
    integrityStatus = 'YELLOW';
  } else {
    integrityStatus = 'GREEN';
  }

  return {
    integrityScore,
    integrityStatus,
    totalDeductions: Number(totalDecayedDeductions.toFixed(2)),
    hasRedInfraction
  };
}

/**
 * Proctoring Escalation Engine
 * Determines final event severity taking into account incident history and escalation rules.
 * Spec rule: 3 oranges become a red; 3 yellows become an orange.
 *
 * @param {Array<Object>} eventHistory - Past events in the session
 * @param {Object} currentEvent - The incoming proctoring event
 * @param {Object} [configs=proctorConfigs] - Configurable proctoring thresholds
 * @returns {Object} Escalation evaluation result { finalSeverity, isEscalated, orangeCount, yellowCount, redCount }
 */
export function evaluateSeverityAndEscalation(eventHistory = [], currentEvent = {}, configs = proctorConfigs) {
  const { escalation, baseSeverityMap } = configs;
  const eventType = currentEvent.type || 'LOOKING_AWAY';
  let initialSeverity = currentEvent.severity || baseSeverityMap[eventType] || 'yellow';

  // Specific duration-based severity adjustments
  if (eventType === 'LOOKING_AWAY') {
    initialSeverity =
      (currentEvent.durationMs || 0) >= (configs.thresholds?.durations?.lookingAwayOrangeMs || 3500)
        ? 'orange'
        : 'yellow';
  }
  if (eventType === 'NO_FACE') {
    const dur = currentEvent.durationMs || 0;
    const redMs = configs.thresholds?.durations?.noFaceRedMs || 6000;
    const orangeMs = configs.thresholds?.durations?.noFaceOrangeMs || 3000;
    if (dur >= redMs) {
      initialSeverity = 'red';
    } else if (dur >= orangeMs) {
      initialSeverity = 'orange';
    } else {
      initialSeverity = 'yellow';
    }
  }

  // Count past active infractions
  const pastYellows = eventHistory.filter((e) => e.severity === 'yellow').length;
  const pastOranges = eventHistory.filter((e) => e.severity === 'orange').length;
  const pastReds = eventHistory.filter((e) => e.severity === 'red').length;

  let finalSeverity = initialSeverity;
  let isEscalated = false;
  let escalationReason = null;

  // 1. Check if yellow escalates to orange (every 3 yellows become orange)
  if (initialSeverity === 'yellow') {
    const totalYellows = pastYellows + 1;
    if (totalYellows >= escalation.yellowsToOrange && totalYellows % escalation.yellowsToOrange === 0) {
      finalSeverity = 'orange';
      isEscalated = true;
      escalationReason = `${escalation.yellowsToOrange} yellow warnings escalated to ORANGE`;
    }
  }

  // 2. Check if orange escalates to red (3 oranges become a red)
  if (finalSeverity === 'orange') {
    const effectiveOranges = pastOranges + 1;
    if (effectiveOranges >= escalation.orangesToRed) {
      finalSeverity = 'red';
      isEscalated = true;
      escalationReason = `${effectiveOranges} orange infractions escalated to RED`;
    }
  }

  // If already red, it stays red
  if (initialSeverity === 'red') {
    finalSeverity = 'red';
  }

  return {
    eventType,
    initialSeverity,
    finalSeverity,
    isEscalated,
    escalationReason,
    counts: {
      yellow: pastYellows + (finalSeverity === 'yellow' ? 1 : 0),
      orange: pastOranges + (finalSeverity === 'orange' ? 1 : 0),
      red: pastReds + (finalSeverity === 'red' ? 1 : 0)
    }
  };
}

export default proctorConfigs;
