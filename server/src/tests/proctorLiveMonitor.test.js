import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { saveEvidence, cleanupExpiredEvidence } from '../services/proctor/evidenceStorage.js';
import { logProctorAction, getSessionAuditLogs } from '../services/proctor/auditService.js';
import { proctorConfigs, evaluateSeverityAndEscalation, calculateTimeDecayedIntegrityScore } from '../config/proctorConfig.js';

describe('Recruiter Live-Monitor, Evidence Storage & Audit Suite', () => {
  const dummySessionId = '654321654321654321654321';

  describe('Rolling Evidence Buffer & Storage Handling', () => {
    it('saves rolling media buffer and snapshot with correct expiresAt based on retentionDays', async () => {
      const dummyBuffer = Buffer.from('FAKE_WEBM_VIDEO_DATA_BUFFER');
      const snapshotBase64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD...';

      const evidence = await saveEvidence({
        sessionId: dummySessionId,
        alertId: 'alert_orange_1',
        eventType: 'MULTIPLE_FACES',
        severity: 'orange',
        mediaBuffer: dummyBuffer,
        mimeType: 'video/webm',
        snapshotBase64,
        durationSeconds: 10,
        retentionDays: 30
      });

      expect(evidence).toBeDefined();
      expect(evidence.eventType).toBe('MULTIPLE_FACES');
      expect(evidence.severity).toBe('orange');
      expect(evidence.mediaType).toBe('video_buffer');
      expect(evidence.sizeBytes).toBe(dummyBuffer.length);
      expect(evidence.downloadUrl).toContain('/api/proctor/evidence/');
      expect(evidence.expiresAt).toBeDefined();

      const retentionMs = new Date(evidence.expiresAt).getTime() - new Date(evidence.capturedAt).getTime();
      const expectedDays = Math.round(retentionMs / (24 * 60 * 60 * 1000));
      expect(expectedDays).toBe(30);
    });

    it('handles snapshot-only evidence when video buffer is absent', async () => {
      const evidence = await saveEvidence({
        sessionId: dummySessionId,
        alertId: 'alert_snap_1',
        eventType: 'PROHIBITED_OBJECT',
        severity: 'orange',
        snapshotBase64: 'data:image/jpeg;base64,abc123dummy',
        retentionDays: 14
      });

      expect(evidence.mediaType).toBe('snapshot');
      expect(evidence.sizeBytes).toBe(0);
      expect(evidence.snapshotBase64).toContain('abc123dummy');
      expect(evidence.downloadUrl).toBeDefined();
    });

    it('retention cleanup job runs gracefully without throwing', async () => {
      const cleanupResult = await cleanupExpiredEvidence();
      expect(cleanupResult).toBeDefined();
      expect(typeof cleanupResult.purgedCount).toBe('number');
      expect(Array.isArray(cleanupResult.deletedFileIds)).toBe(true);
    });
  });

  describe('Audit Logging System', () => {
    it('logs recruiter actions (warnings, pause, termination, notes) to audit log', async () => {
      const actionLog = await logProctorAction({
        action: 'PROCTOR_WARNING_SENT',
        performedBy: '654321654321654321654322',
        userEmail: 'recruiter@adaptiq.ai',
        userRole: 'recruiter',
        targetType: 'SESSION',
        targetId: dummySessionId,
        reason: 'Candidate looking away repeatedly. Advisory issued.'
      });

      expect(actionLog).toBeDefined();
      expect(actionLog.action).toBe('PROCTOR_WARNING_SENT');
      expect(actionLog.userEmail).toBe('recruiter@adaptiq.ai');
      expect(actionLog.targetId).toBe(dummySessionId);

      const logs = await getSessionAuditLogs(dummySessionId);
      expect(logs.length).toBeGreaterThan(0);
      const found = logs.find((l) => l.action === 'PROCTOR_WARNING_SENT');
      expect(found).toBeDefined();
    });

    it('logs automated onRed escalation events in audit trail', async () => {
      const redAudit = await logProctorAction({
        action: 'PROCTOR_ON_RED_TRIGGERED',
        userEmail: 'system@adaptiq.ai',
        userRole: 'system',
        targetType: 'SESSION',
        targetId: dummySessionId,
        reason: 'Automated session pause triggered by proctorConfig.onRed = pause.'
      });

      expect(redAudit.action).toBe('PROCTOR_ON_RED_TRIGGERED');
      expect(redAudit.reason).toContain('proctorConfig.onRed = pause');
    });
  });

  describe('proctorConfig.onRed Policy & Escalation Flow', () => {
    it('supports onRed policies: continue, pause, terminate', () => {
      expect(['continue', 'pause', 'terminate']).toContain(proctorConfigs.onRed);
      expect(proctorConfigs.retentionDays).toBe(30);
    });

    it('escalates 3 orange infractions into a red infraction triggering RED status', () => {
      const history = [
        { type: 'PROHIBITED_OBJECT', severity: 'orange', timestamp: new Date(Date.now() - 50000) },
        { type: 'MULTIPLE_FACES', severity: 'orange', timestamp: new Date(Date.now() - 30000) }
      ];

      const currentEvent = {
        type: 'VIRTUAL_CAMERA',
        severity: 'orange',
        timestamp: new Date()
      };

      const escalation = evaluateSeverityAndEscalation(history, currentEvent, proctorConfigs);
      expect(escalation.finalSeverity).toBe('red');
      expect(escalation.isEscalated).toBe(true);
      expect(escalation.escalationReason).toContain('escalated to RED');

      // Verify integrity status becomes RED
      const updatedHistory = [...history, { ...currentEvent, severity: escalation.finalSeverity }];
      const scoreResult = calculateTimeDecayedIntegrityScore(updatedHistory, new Date(), proctorConfigs);
      expect(scoreResult.integrityStatus).toBe('RED');
      expect(scoreResult.hasRedInfraction).toBe(true);
    });
  });
});
