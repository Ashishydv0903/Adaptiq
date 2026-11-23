import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { InterviewScreen } from '../pages/InterviewScreen.jsx';
import { api } from '../services/api.js';

vi.mock('../services/api.js', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn()
  },
  proctorAPI: {
    uploadEvidence: vi.fn()
  }
}));

vi.mock('../hooks/useProctor', () => ({
  useProctor: () => ({
    latestWarning: null,
    dismissWarning: vi.fn(),
    violationCounts: { yellow: 0, orange: 0, red: 0 },
    integrityScore: 100,
    integrityStatus: 'GREEN',
    sessionControlState: { status: 'in_progress' },
    checkAnswerSpeed: vi.fn(),
    checkAITextRisk: vi.fn()
  })
}));

vi.mock('../components/interview/LiveProctoringMonitor', () => ({
  LiveProctoringMonitor: () => <div data-testid="mock-live-monitor">Mock Live Monitor</div>,
  default: () => <div data-testid="mock-live-monitor">Mock Live Monitor</div>
}));

vi.mock('../components/interview/MonacoCodeEditor', () => ({
  MonacoCodeEditor: () => <div data-testid="mock-monaco-editor">Mock Monaco Editor</div>,
  default: () => <div data-testid="mock-monaco-editor">Mock Monaco Editor</div>
}));

describe('InterviewScreen Component Mount & Render', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially without crashing', () => {
    api.get.mockReturnValue(new Promise(() => {})); // Never resolves to test loading

    render(
      <MemoryRouter initialEntries={['/interview/test_session_123']}>
        <Routes>
          <Route path="/interview/:sessionId" element={<InterviewScreen />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText(/Setting up your interview questions/i)).toBeInTheDocument();
  });

  it('renders tailored interview question upon session fetch', async () => {
    api.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          session: {
            _id: 'test_session_123',
            track: 'fullstack',
            status: 'in_progress',
            abilityTheta: 0.0,
            abilitySem: 1.0,
            percentileScore: 50.0,
            isTargeted: true,
            targetRole: 'Fullstack Software Engineer',
            rounds: [{ roundType: 'behavioral', label: 'Resume Deep Dive' }]
          },
          currentQuestion: {
            _id: 'q_1',
            title: 'Resume Architecture Deep Dive: Acme Cloud Technologies',
            prompt: 'Walk the hiring team through the architectural design of this project.',
            roundType: 'behavioral',
            difficultyLevel: 'medium',
            targetReason: 'Directly evaluates your resume projects'
          },
          timer: { remainingSeconds: 180 }
        }
      }
    });

    render(
      <MemoryRouter initialEntries={['/interview/test_session_123']}>
        <Routes>
          <Route path="/interview/:sessionId" element={<InterviewScreen />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(
        screen.getByText('Resume Architecture Deep Dive: Acme Cloud Technologies')
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText(/Walk the hiring team through the architectural design of this project/i)
    ).toBeInTheDocument();
  });
});
