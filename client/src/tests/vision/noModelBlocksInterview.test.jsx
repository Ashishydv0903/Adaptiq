import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PreInterviewSystemCheck from '../../pages/PreInterviewSystemCheck.jsx';
import InterviewScreen from '../../pages/InterviewScreen.jsx';
import * as faceLandmarker from '../../services/vision/faceLandmarker.js';
import * as objectDetector from '../../services/vision/objectDetector.js';
import * as faceIdentity from '../../services/vision/faceIdentity.js';
import { proctorAPI, api } from '../../services/api.js';

vi.mock('../../services/api.js', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn()
  },
  proctorAPI: {
    getConsent: vi.fn(),
    submitConsent: vi.fn(),
    enrolBiometrics: vi.fn(),
    uploadEvidence: vi.fn()
  }
}));

vi.mock('../../services/vision/faceLandmarker.js', () => ({
  initFaceLandmarker: vi.fn(),
  detectFaceLandmarks: vi.fn()
}));

vi.mock('../../services/vision/objectDetector.js', () => ({
  initObjectDetector: vi.fn()
}));

vi.mock('../../services/vision/faceIdentity.js', () => ({
  initFaceIdentity: vi.fn(),
  enrol: vi.fn()
}));

vi.mock('../../components/mascot/MascotRobot.jsx', () => ({
  default: () => <div data-testid="mascot-robot">Robot</div>
}));

vi.mock('../../components/common/AdaptiveAILogo.jsx', () => ({
  default: () => <div data-testid="adaptive-logo">Logo</div>
}));

// Also mock Monaco & LiveProctoringMonitor for InterviewScreen
vi.mock('../../components/interview/LiveProctoringMonitor', () => ({
  LiveProctoringMonitor: () => <div data-testid="mock-live-monitor">Mock Live Monitor</div>,
  default: () => <div data-testid="mock-live-monitor">Mock Live Monitor</div>
}));

vi.mock('../../components/interview/MonacoCodeEditor', () => ({
  MonacoCodeEditor: () => <div data-testid="mock-monaco-editor">Mock Monaco Editor</div>,
  default: () => <div data-testid="mock-monaco-editor">Mock Monaco Editor</div>
}));

// Mock useProctor hook for InterviewScreen
const mockUseProctor = vi.fn();
vi.mock('../../hooks/useProctor.js', () => ({
  useProctor: () => mockUseProctor()
}));

describe('Fail-Loudly: No Model Loaded Blocks Interview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('PreInterviewSystemCheck', () => {
    it('blocks interview start and renders loud error when vision models fail to load', async () => {
      // Consent is already given
      proctorAPI.getConsent.mockResolvedValue({
        data: { data: { hasConsented: true } }
      });

      // Simulate model loading failure (e.g., missing weights or wasm failure)
      faceLandmarker.initFaceLandmarker.mockRejectedValue(new Error('Model weights missing 404'));
      objectDetector.initObjectDetector.mockResolvedValue({});
      faceIdentity.initFaceIdentity.mockResolvedValue({});

      render(
        <MemoryRouter initialEntries={['/system-check/session_123']}>
          <Routes>
            <Route path="/system-check/:sessionId" element={<PreInterviewSystemCheck />} />
          </Routes>
        </MemoryRouter>
      );

      // Verify the loud error banner is displayed
      await waitFor(() => {
        expect(screen.getByText(/Vision Models Loading Error/i)).toBeInTheDocument();
      });

      expect(
        screen.getByText(/AI Proctoring models failed to load: Model weights missing 404/i)
      ).toBeInTheDocument();

      // Verify "Retry Models" button is visible
      const retryBtn = screen.getByRole('button', { name: /Retry Models/i });
      expect(retryBtn).toBeInTheDocument();

      // Verify the gatekeeper status shows gated
      expect(screen.getByText(/Gated: Complete All 6 Checks/i)).toBeInTheDocument();

      // Click "Start Interview" button - should be blocked
      const startBtn = screen.getByRole('button', { name: /Start Interview/i });
      fireEvent.click(startBtn);

      // Verify loud error message that interview cannot proceed
      await waitFor(() => {
        expect(
          screen.getByText(/Interview cannot start: AI proctoring computer vision models are not loaded/i)
        ).toBeInTheDocument();
      });
    });

    it('clears error and allows progress when retry succeeds', async () => {
      proctorAPI.getConsent.mockResolvedValue({
        data: { data: { hasConsented: true } }
      });

      // First call fails
      faceLandmarker.initFaceLandmarker.mockRejectedValueOnce(new Error('Temporary network glitch'));
      objectDetector.initObjectDetector.mockResolvedValue({});
      faceIdentity.initFaceIdentity.mockResolvedValue({});

      render(
        <MemoryRouter initialEntries={['/system-check/session_456']}>
          <Routes>
            <Route path="/system-check/:sessionId" element={<PreInterviewSystemCheck />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Vision Models Loading Error/i)).toBeInTheDocument();
      });

      // Now set mock to succeed on retry
      faceLandmarker.initFaceLandmarker.mockResolvedValue({});

      const retryBtn = screen.getByRole('button', { name: /Retry Models/i });
      fireEvent.click(retryBtn);

      // Error banner should disappear after successful loading
      await waitFor(() => {
        expect(screen.queryByText(/Vision Models Loading Error/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('InterviewScreen', () => {
    it('renders blocking overlay with retry when modelsError occurs during interview session', async () => {
      const mockRetryModels = vi.fn();
      mockUseProctor.mockReturnValue({
        latestWarning: null,
        dismissWarning: vi.fn(),
        violationCounts: { yellow: 0, orange: 0, red: 0 },
        integrityScore: 100,
        integrityStatus: 'GREEN',
        sessionControlState: { status: 'in_progress' },
        modelsLoaded: false,
        modelsError: 'Vision models initialization failed: FaceLandmarker unreachable',
        retryModels: mockRetryModels,
        isLowPerformanceMode: false,
        injectDemoEvent: vi.fn(),
        facePresencePct: 100,
        focusRetentionPct: 100,
        tabSwitchCount: 0,
        cameraAvailable: true,
        micAvailable: true,
        isFacePresent: true,
        isFocused: true,
        trustScore: 100,
        proctorAuditTimeline: []
      });

      api.get.mockResolvedValue({
        data: {
          data: {
            session: {
              _id: 'session_789',
              status: 'in_progress',
              track: 'fullstack',
              targetRole: 'Full Stack Engineer',
              abilityTheta: 0,
              abilitySem: 0.5,
              percentileScore: 50,
              rounds: [],
              currentRoundIndex: 0
            },
            currentQuestion: {
              _id: 'q_1',
              title: 'Explain Event Loop',
              prompt: 'Explain how Node.js event loop works.',
              roundType: 'conceptual'
            }
          }
        }
      });

      render(
        <MemoryRouter initialEntries={['/interview/session_789']}>
          <Routes>
            <Route path="/interview/:sessionId" element={<InterviewScreen />} />
          </Routes>
        </MemoryRouter>
      );

      // Wait for session and verify models error overlay appears
      await waitFor(() => {
        expect(screen.getByText(/AI Proctoring Models Required/i)).toBeInTheDocument();
      });

      expect(
        screen.getByText(/Vision models initialization failed: FaceLandmarker unreachable/i)
      ).toBeInTheDocument();

      expect(
        screen.getByText(/The interview cannot proceed without computer vision integrity models. There is no silent fallback to simulation./i)
      ).toBeInTheDocument();

      const retryBtn = screen.getByRole('button', { name: /Retry Loading Models/i });
      expect(retryBtn).toBeInTheDocument();

      fireEvent.click(retryBtn);
      expect(mockRetryModels).toHaveBeenCalledTimes(1);
    });
  });
});
