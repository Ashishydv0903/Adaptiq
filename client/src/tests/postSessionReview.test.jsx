import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PostSessionReview from '../pages/PostSessionReview';
import { proctorAPI } from '../services/api';

// Mock proctorAPI
vi.mock('../services/api', () => ({
  proctorAPI: {
    getSessionReviewTimeline: vi.fn(),
    submitReviewAction: vi.fn(),
    getTuningMetrics: vi.fn()
  }
}));

describe('PostSessionReview Component Suite', () => {
  const dummySessionId = 'sess_post_review_123';

  const mockTimelineResponse = {
    data: {
      success: true,
      data: {
        session: {
          id: dummySessionId,
          candidateName: 'Jane Dev',
          candidateEmail: 'jane@example.com',
          track: 'Fullstack Engineering',
          status: 'flagged',
          integrityScore: 68,
          integrityStatus: 'ORANGE',
          totalDurationSeconds: 1800,
          startedAt: new Date(Date.now() - 1800000).toISOString(),
          endedAt: new Date().toISOString()
        },
        events: [
          {
            id: 'ev_1',
            type: 'LOOKING_AWAY',
            severity: 'orange',
            confidence: 0.88,
            timestamp: new Date(Date.now() - 1200000).toISOString(),
            offsetSeconds: 600,
            message: 'Candidate looked away from screen for 4.2 seconds.',
            downloadUrl: '/api/proctor/evidence/clip_1.webm',
            snapshot: 'data:image/jpeg;base64,mockSnap1',
            reviewLabel: null,
            isFalsePositive: false
          },
          {
            id: 'ev_2',
            type: 'MULTIPLE_FACES',
            severity: 'red',
            confidence: 0.95,
            timestamp: new Date(Date.now() - 600000).toISOString(),
            offsetSeconds: 1200,
            message: 'Secondary face detected in camera viewport.',
            downloadUrl: null,
            snapshot: 'data:image/jpeg;base64,mockSnap2',
            reviewLabel: null,
            isFalsePositive: false
          }
        ],
        knownLimitations: [
          {
            title: 'Ambient Lighting & Optical Variability',
            description: 'Optical landmark detection requires sufficient workspace illumination (> 50 lux).'
          },
          {
            title: 'Mandatory Human-in-the-Loop Governance',
            description: 'AI proctoring alarms serve solely as advisory markers for human audit.'
          }
        ]
      }
    }
  };

  const mockTuningResponse = {
    data: {
      success: true,
      data: {
        aggregateFalsePositiveRate: 24.5,
        events: [
          {
            type: 'LOOKING_AWAY',
            totalOccurrences: 14,
            confirmedViolations: 8,
            dismissedFalsePositives: 6,
            falsePositiveRate: 42.8,
            recommendation: 'High FPR. Increase yaw/pitch tolerance.'
          }
        ]
      }
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    proctorAPI.getSessionReviewTimeline.mockResolvedValue(mockTimelineResponse);
    proctorAPI.getTuningMetrics.mockResolvedValue(mockTuningResponse);
    proctorAPI.submitReviewAction.mockResolvedValue({
      data: {
        success: true,
        message: 'Review decision recorded',
        data: {
          integrityScore: 78,
          integrityStatus: 'YELLOW'
        }
      }
    });
  });

  const renderComponent = () =>
    render(
      <MemoryRouter initialEntries={[`/recruiter/review/${dummySessionId}`]}>
        <Routes>
          <Route path="/recruiter/review/:sessionId" element={<PostSessionReview />} />
        </Routes>
      </MemoryRouter>
    );

  it('renders candidate header, integrity status chip, and duration', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Jane Dev')).toBeInTheDocument();
      expect(screen.getByText(/Fullstack Engineering/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/ORANGE/i)).toBeInTheDocument();
    expect(screen.getByText(/68\/100/i)).toBeInTheDocument();
    expect(screen.getAllByText(/30:00/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Events \(2\):/i)).toBeInTheDocument();
  });

  it('renders interactive timeline slider with event markers and handles scrub change', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('#1 LOOKING_AWAY')).toBeInTheDocument();
      expect(screen.getByText('#2 MULTIPLE_FACES')).toBeInTheDocument();
    });

    const scrubSlider = screen.getByRole('slider');
    expect(scrubSlider).toBeInTheDocument();

    // Change scrub slider value to 1200 seconds (jump near event 2)
    fireEvent.change(scrubSlider, { target: { value: 1200 } });
    expect(scrubSlider.value).toBe('1200');

    // Should focus on event #2
    await waitFor(() => {
      expect(screen.getByText('Infraction Media Evidence (#2)')).toBeInTheDocument();
      expect(screen.getByText('MULTIPLE_FACES')).toBeInTheDocument();
    });
  });

  it('executes "Confirm Violation" action and updates session review disposition', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('LOOKING_AWAY')).toBeInTheDocument();
    });

    const notesInput = screen.getByPlaceholderText(/Document context/i);
    fireEvent.change(notesInput, { target: { value: 'Confirmed candidate consulted secondary notes.' } });

    const confirmBtn = screen.getByRole('button', { name: /Confirm Violation/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(proctorAPI.submitReviewAction).toHaveBeenCalledWith(
        dummySessionId,
        expect.objectContaining({
          action: 'confirm_violation',
          notes: 'Confirmed candidate consulted secondary notes.'
        })
      );
    });

    expect(
      screen.getByText(/Violation confirmed. Session flagged in review queue./i)
    ).toBeInTheDocument();
  });

  it('executes "Dismiss as False Positive" action and recalculates candidate score', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('LOOKING_AWAY')).toBeInTheDocument();
    });

    const dismissBtn = screen.getByRole('button', { name: /Dismiss as False Positive/i });
    fireEvent.click(dismissBtn);

    await waitFor(() => {
      expect(proctorAPI.submitReviewAction).toHaveBeenCalledWith(
        dummySessionId,
        expect.objectContaining({
          action: 'dismiss_false_positive'
        })
      );
    });

    expect(
      screen.getByText(/Dismissed as false positive. Candidate integrity score recalculated./i)
    ).toBeInTheDocument();
  });

  it('executes "Request Re-Test" action for inconclusive telemetry', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('LOOKING_AWAY')).toBeInTheDocument();
    });

    const retestBtn = screen.getByRole('button', { name: /Request Candidate Re-Test/i });
    fireEvent.click(retestBtn);

    await waitFor(() => {
      expect(proctorAPI.submitReviewAction).toHaveBeenCalledWith(
        dummySessionId,
        expect.objectContaining({
          action: 'request_retest'
        })
      );
    });

    expect(
      screen.getByText(/Re-test requested. Candidate flagged for retake./i)
    ).toBeInTheDocument();
  });

  it('opens and closes the Known Limitations modal displaying regulatory guidelines', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Known Limitations/i })).toBeInTheDocument();
    });

    const limitationsBtn = screen.getByRole('button', { name: /Known Limitations/i });
    fireEvent.click(limitationsBtn);

    expect(
      screen.getByText(/AI Proctoring & Biometrics: Known Limitations/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Ambient Lighting & Optical Variability/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Mandatory Human-in-the-Loop Governance/i)
    ).toBeInTheDocument();

    // Close modal
    const closeBtn = screen.getByRole('button', { name: /^Close$/i });
    fireEvent.click(closeBtn);

    expect(
      screen.queryByText(/AI Proctoring & Biometrics: Known Limitations/i)
    ).not.toBeInTheDocument();
  });
});
