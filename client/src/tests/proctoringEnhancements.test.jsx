import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { LiveProctoringMonitor } from '../components/interview/LiveProctoringMonitor';
import { ComprehensiveFeedbackReport } from '../components/interview/ComprehensiveFeedbackReport';

// Mock getUserMedia
beforeAll(() => {
  if (!navigator.mediaDevices) {
    navigator.mediaDevices = {};
  }
  navigator.mediaDevices.getUserMedia = vi.fn().mockResolvedValue({
    getTracks: () => [{ stop: vi.fn() }]
  });
});

describe('LiveProctoringMonitor Enhanced Integrity & Badges', () => {
  it('renders standard Focused ✅ and Face Detected ✅ badges and real-time metrics strip', () => {
    render(
      <LiveProctoringMonitor
        sessionId="sess_test_123"
        focusStatus="focused"
        facePresenceStatus="face_detected"
        tabSwitchCount={0}
        facePresencePct={98}
        focusRetentionPct={100}
        cameraAvailable={true}
        micAvailable={true}
        trustScore={100}
      />
    );

    expect(screen.getByText(/Focused/i)).toBeInTheDocument();
    expect(screen.getByText(/Face Detected/i)).toBeInTheDocument();
    expect(screen.getByText(/Face Presence %/i)).toBeInTheDocument();
    expect(screen.getByText('98%')).toBeInTheDocument();
    expect(screen.getByText(/Focus Retention %/i)).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText(/Tab Switch Count/i)).toBeInTheDocument();
    expect(screen.getByText(/0 switches/i)).toBeInTheDocument();
    expect(screen.getByText(/Real-Time Integrity Dashboard/i)).toBeInTheDocument();
  });

  it('renders Tab Switched ⚠️ and Face Missing ⚠️ badges when infractions occur', () => {
    render(
      <LiveProctoringMonitor
        sessionId="sess_test_456"
        focusStatus="tab_switched"
        facePresenceStatus="face_missing"
        tabSwitchCount={2}
        facePresencePct={70}
        focusRetentionPct={85}
        cameraAvailable={true}
        micAvailable={true}
        trustScore={85}
      />
    );

    expect(screen.getByText(/Tab Switched ⚠️/i)).toBeInTheDocument();
    expect(screen.getByText(/Face Missing ⚠️/i)).toBeInTheDocument();
    expect(screen.getByText('2 switches')).toBeInTheDocument();
    expect(screen.getByText(/Trust Score: 85\/100/i)).toBeInTheDocument();
  });

  it('renders Window Out of Focus ⚠️ and Multiple Faces Detected 🚨 badges', () => {
    render(
      <LiveProctoringMonitor
        sessionId="sess_test_789"
        focusStatus="window_out_of_focus"
        facePresenceStatus="multiple_faces"
        tabSwitchCount={1}
        facePresencePct={90}
        focusRetentionPct={92}
        cameraAvailable={true}
        micAvailable={true}
        trustScore={80}
      />
    );

    expect(screen.getByText(/Window Out of Focus ⚠️/i)).toBeInTheDocument();
    expect(screen.getByText(/Multiple Faces Detected 🚨/i)).toBeInTheDocument();
  });
});

describe('ComprehensiveFeedbackReport Integrity & Audit Trail Section', () => {
  it('renders real-time integrity dashboard, deductions breakdown, and audit timeline', () => {
    const feedbackData = {
      finalScore: 82,
      verdict: 'Interview Completed Successfully',
      summaryText: 'Good performance across technical and behavioral questions.',
      strengths: ['Great algorithm depth', 'Clear STAR explanations'],
      improvements: ['Consider edge cases for empty strings'],
      topicsToFocusOn: [],
      actionPlan: [],
      questionBreakdown: [],
      targetRole: 'Fullstack Engineer',
      targetCompany: 'InnovateTech',
      isEarlyExit: true,
      isPartialScorecard: true,
      integrityMetrics: {
        facePresencePct: 92,
        focusRetentionPct: 88,
        tabSwitchCount: 2,
        cameraAvailable: true,
        micAvailable: true,
        trustScore: 85,
        trustDeductions: [
          { reason: 'Tab switch detected (switch #1)', points: 3, timestamp: '2026-11-23T10:05:00Z' },
          { reason: 'Face missing for >3 seconds', points: 12, timestamp: '2026-11-23T10:12:00Z' }
        ]
      },
      auditLog: [
        { eventType: 'TAB_SWITCH', severity: 'warning', durationMs: 2500, deduction: 3, timestamp: '2026-11-23T10:05:00Z' },
        { eventType: 'FACE_NOT_DETECTED', severity: 'alert', durationMs: 4000, deduction: 12, timestamp: '2026-11-23T10:12:00Z' },
        { eventType: 'MANUAL_EXIT', severity: 'info', deduction: 0, timestamp: '2026-11-23T10:15:00Z' }
      ]
    };

    render(
      <BrowserRouter>
        <ComprehensiveFeedbackReport
          feedbackData={feedbackData}
          sessionId="sess_test_feedback"
        />
      </BrowserRouter>
    );

    // Verify Partial Scorecard Notice
    expect(screen.getByText(/Partial Assessment Scorecard \(Early Exit\)/i)).toBeInTheDocument();

    // Verify Integrity & Proctoring Report Card
    expect(screen.getByText(/Interview Integrity & Proctoring Report/i)).toBeInTheDocument();
    expect(screen.getByText('85 / 100')).toBeInTheDocument();
    expect(screen.getByText('92%')).toBeInTheDocument();
    expect(screen.getByText('88%')).toBeInTheDocument();

    // Verify Trust Score Deductions
    expect(screen.getByText(/Trust Score Calculation & Deductions/i)).toBeInTheDocument();
    expect(screen.getByText(/Tab switch detected \(switch #1\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Face missing for >3 seconds/i)).toBeInTheDocument();

    // Verify Proctoring Audit Log Timeline
    expect(screen.getByText(/Proctoring Audit Log Timeline \(3 events logged\)/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Tab Switch/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Face Not Detected \(>3s\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Manual Interview Exit/i)).toBeInTheDocument();
  });
});
