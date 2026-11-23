import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import RecruiterLiveMonitor from '../components/recruiter/RecruiterLiveMonitor';

// Mock proctorAPI
vi.mock('../services/api', () => ({
  proctorAPI: {
    getActiveSessions: vi.fn().mockResolvedValue({
      data: {
        success: true,
        data: {
          count: 2,
          sessions: [
            {
              id: 'sess_1',
              candidateName: 'Alice Candidate',
              candidateEmail: 'alice@domain.com',
              track: 'fullstack',
              currentRound: 'coding',
              status: 'in_progress',
              onRedPolicy: 'pause',
              integrityScore: 95,
              integrityStatus: 'GREEN',
              currentQuestionIndex: 2,
              totalQuestions: 8,
              alerts: { total: 1, red: 0, orange: 0, yellow: 1 },
              recentEvents: [
                {
                  type: 'TAB_SWITCH',
                  message: 'Tab switch detected.',
                  severity: 'yellow',
                  timestamp: new Date().toISOString()
                }
              ]
            },
            {
              id: 'sess_2',
              candidateName: 'Bob Flagged',
              candidateEmail: 'bob@domain.com',
              track: 'backend',
              currentRound: 'technical',
              status: 'flagged',
              onRedPolicy: 'terminate',
              integrityScore: 45,
              integrityStatus: 'RED',
              currentQuestionIndex: 4,
              totalQuestions: 8,
              alerts: { total: 3, red: 1, orange: 2, yellow: 0 },
              recentEvents: [
                {
                  type: 'MULTIPLE_FACES',
                  message: 'Multiple faces detected in frame.',
                  severity: 'red',
                  timestamp: new Date().toISOString()
                }
              ]
            }
          ]
        }
      }
    }),
    executeSessionAction: vi.fn().mockResolvedValue({
      data: { success: true, message: 'Action executed' }
    }),
    getSessionAuditLogs: vi.fn().mockResolvedValue({
      data: {
        success: true,
        data: {
          logs: [
            {
              action: 'PROCTOR_WARNING_SENT',
              reason: 'Advisory issued',
              userEmail: 'recruiter@adaptiq.ai',
              userRole: 'recruiter',
              timestamp: new Date().toISOString()
            }
          ]
        }
      }
    })
  }
}));

// Mock socket.io-client
vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn()
  }))
}));

describe('RecruiterLiveMonitor Component', () => {
  const renderComponent = () =>
    render(
      <MemoryRouter>
        <RecruiterLiveMonitor />
      </MemoryRouter>
    );

  it('renders header, search bar, and filter tabs', async () => {
    renderComponent();

    expect(screen.getByText(/Recruiter Live Proctoring Monitor/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Search candidate name, email, or track/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^ALL$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^RED$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^GREEN$/i })).toBeInTheDocument();
  });

  it('renders candidate session cards with status chips and infraction counts', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Alice Candidate')).toBeInTheDocument();
      expect(screen.getByText('Bob Flagged')).toBeInTheDocument();
    });

    expect(screen.getByText(/GREEN \(95\)/i)).toBeInTheDocument();
    expect(screen.getByText(/RED \(45\)/i)).toBeInTheDocument();
    expect(screen.getAllByText(/onRed:/i).length).toBe(2);
  });

  it('filters candidates when status tab is selected', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Alice Candidate')).toBeInTheDocument();
      expect(screen.getByText('Bob Flagged')).toBeInTheDocument();
    });

    // Click RED filter tab
    const redTab = screen.getByRole('button', { name: /^RED$/i });
    fireEvent.click(redTab);

    expect(screen.getByText('Bob Flagged')).toBeInTheDocument();
    expect(screen.queryByText('Alice Candidate')).not.toBeInTheDocument();
  });

  it('opens warning action modal when Warn button is clicked', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Alice Candidate')).toBeInTheDocument();
    });

    const warnButtons = screen.getAllByRole('button', { name: /warn/i });
    fireEvent.click(warnButtons[0]);

    expect(screen.getByText(/Dispatch Warning to Candidate/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirm Action/i })).toBeInTheDocument();
  });

  it('toggles sound alert chime button', () => {
    renderComponent();
    const soundButton = screen.getByTitle(/Red Alert Audio Chime Enabled/i);
    expect(soundButton).toBeInTheDocument();

    fireEvent.click(soundButton);
    expect(screen.getByTitle(/Mute Red Alert Audio/i)).toBeInTheDocument();
  });
});
