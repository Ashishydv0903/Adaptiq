import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import ExplainableFeedbackModal from '../components/feedback/ExplainableFeedbackModal';
import { ComprehensiveFeedbackReport } from '../components/interview/ComprehensiveFeedbackReport';

describe('Honest AI Layer UI - Offline & AI-Evaluated Badges', () => {
  describe('ExplainableFeedbackModal', () => {
    it('displays "Offline estimate (not AI-evaluated)" badge when evaluatedBy is heuristic', () => {
      const heuristicEval = {
        score: 65,
        finalScore: 65,
        passedGate: true,
        evaluatedBy: 'heuristic',
        confidence: 'Low',
        confidenceReason: 'Offline heuristic estimate (not AI-evaluated)',
        evidence: 'Candidate mentioned database indexing concepts.'
      };

      render(
        <ExplainableFeedbackModal
          isOpen={true}
          onClose={vi.fn()}
          evaluation={heuristicEval}
          question={{ title: 'Indexing Question' }}
          candidateAnswer="B-Trees are used for indexing."
        />
      );

      const badge = screen.getByTestId('offline-estimate-badge');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent('Offline estimate (not AI-evaluated)');
    });

    it('does NOT display offline estimate badge when evaluatedBy is llm', () => {
      const llmEval = {
        score: 85,
        finalScore: 85,
        passedGate: true,
        evaluatedBy: 'llm',
        confidence: 'High',
        confidenceReason: 'Candidate demonstrated clear structured logic.',
        evidence: 'Candidate mentioned B-Trees and clustered indexes.'
      };

      render(
        <ExplainableFeedbackModal
          isOpen={true}
          onClose={vi.fn()}
          evaluation={llmEval}
          question={{ title: 'Indexing Question' }}
          candidateAnswer="B-Trees are used for indexing."
        />
      );

      expect(screen.queryByTestId('offline-estimate-badge')).not.toBeInTheDocument();
    });
  });

  describe('ComprehensiveFeedbackReport', () => {
    const mockBaseFeedback = {
      overallScore: 78,
      readinessLevel: 'Job Ready',
      skillBreakdown: [
        { skill: 'Algorithms', score: 80, benchmark: 75 },
        { skill: 'System Design', score: 75, benchmark: 70 }
      ],
      qualitativeAnalysis: {
        strengths: ['Clear explanations'],
        weaknesses: ['Could add more test cases'],
        actionableRoadmap: ['Practice distributed caching']
      },
      proctoringSummary: {
        trustScore: 95,
        integrityScore: 95,
        tabSwitchCount: 0,
        focusRetentionRate: 100,
        facePresenceRate: 100,
        unauthorizedObjectsDetected: [],
        anomalies: []
      }
    };

    it('displays "Offline estimate (not AI-evaluated)" badge when session evaluatedBy is heuristic', () => {
      const feedbackWithHeuristic = {
        ...mockBaseFeedback,
        evaluatedBy: 'heuristic',
        hasHeuristicEvaluations: true
      };

      render(
        <BrowserRouter>
          <ComprehensiveFeedbackReport
            feedbackData={feedbackWithHeuristic}
            onRetake={vi.fn()}
            sessionId="test-session-123"
          />
        </BrowserRouter>
      );

      const badge = screen.getByTestId('session-offline-badge');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent('Offline estimate (not AI-evaluated)');
    });

    it('does NOT display offline estimate badge when session is fully AI-evaluated', () => {
      const feedbackWithLLM = {
        ...mockBaseFeedback,
        evaluatedBy: 'llm',
        hasHeuristicEvaluations: false
      };

      render(
        <BrowserRouter>
          <ComprehensiveFeedbackReport
            feedbackData={feedbackWithLLM}
            onRetake={vi.fn()}
            sessionId="test-session-123"
          />
        </BrowserRouter>
      );

      expect(screen.queryByTestId('session-offline-badge')).not.toBeInTheDocument();
    });
  });
});
