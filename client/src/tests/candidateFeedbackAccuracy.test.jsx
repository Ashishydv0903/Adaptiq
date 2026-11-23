import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import ExplainableFeedbackModal from '../components/feedback/ExplainableFeedbackModal';
import { ComprehensiveFeedbackReport } from '../components/interview/ComprehensiveFeedbackReport';

describe('Candidate Feedback Accuracy & Readability', () => {
  describe('ExplainableFeedbackModal - Answer Relevance Gate & Evidence', () => {
    it('renders exact fallback alert banner and hides detailed skill feedback when answer is gated', () => {
      const gatedEval = {
        score: 0.1,
        finalScore: 0.1,
        passedGate: false,
        gateMessage:
          'We could not accurately assess this answer because it was incomplete, unrelated, or lacked sufficient information.',
        confidence: 'Low',
        confidenceReason: 'Answer did not meet basic relevance or completeness criteria.',
        evidence: 'Insufficient evidence to assess.',
        qualityChecks: {
          relevance: { score: 15, display: '15%' },
          completeness: { score: null, display: 'Insufficient evidence to assess.' },
          clarity: { score: null, display: 'Insufficient evidence to assess.' },
          technicalDepth: { score: null, display: 'Insufficient evidence to assess.' }
        }
      };

      render(
        <ExplainableFeedbackModal
          isOpen={true}
          onClose={vi.fn()}
          evaluation={gatedEval}
          question={{ title: 'Database Indexing' }}
          candidateAnswer="asdfasdf"
        />
      );

      // Verify exact required message
      expect(
        screen.getAllByText(
          'We could not accurately assess this answer because it was incomplete, unrelated, or lacked sufficient information.'
        ).length
      ).toBeGreaterThanOrEqual(1);

      // Verify Confidence
      expect(screen.getByText(/Confidence: Low/i)).toBeInTheDocument();

      // Verify Insufficient evidence to assess
      expect(screen.getAllByText(/Insufficient evidence to assess\./i).length).toBeGreaterThanOrEqual(1);

      // Verify detailed praise is suppressed
      expect(screen.queryByText(/What You Got Right/i)).not.toBeInTheDocument();
    });

    it('renders confidence, answer quality scores, and evidence excerpt when answer passes gate', () => {
      const validEval = {
        score: 85,
        finalScore: 85,
        passedGate: true,
        confidence: 'High',
        confidenceReason: 'Candidate clearly explained reasoning and used structured language.',
        evidence: 'I would first identify the bottleneck and then optimize the database queries.',
        qualityChecks: {
          relevance: { score: 90, display: '90%' },
          completeness: { score: 85, display: '85%' },
          clarity: { score: 88, display: '88%' },
          technicalDepth: { score: 82, display: '82%' }
        },
        conceptCoverage: {
          coveredConcepts: [
            { concept: 'B-Tree Indexing', explanation: 'Correctly identified B-Tree indexing for range queries.' }
          ],
          missingConcepts: [
            { concept: 'Explain Analyze Plan', explanation: 'Mention EXPLAIN ANALYZE for runtime metrics.' }
          ]
        },
        counterfactuals: [
          { actionableSuggestion: 'Discuss tradeoffs in your answers' }
        ]
      };

      render(
        <ExplainableFeedbackModal
          isOpen={true}
          onClose={vi.fn()}
          evaluation={validEval}
          question={{ title: 'Database Optimization' }}
          candidateAnswer="I would first identify the bottleneck and then optimize the database queries."
        />
      );

      // Score
      expect(screen.getByText('85')).toBeInTheDocument();

      // Confidence
      expect(screen.getByText(/Confidence: High/i)).toBeInTheDocument();

      // Quality checks
      expect(screen.getByText('90%')).toBeInTheDocument();
      expect(screen.getByText('88%')).toBeInTheDocument();

      // Evidence
      expect(
        screen.getByText(/"I would first identify the bottleneck and then optimize the database queries\."/i)
      ).toBeInTheDocument();

      // Strengths & Needs improvement
      expect(screen.getByText(/Strengths \(What You Got Right\)/i)).toBeInTheDocument();
      expect(screen.getAllByText(/B-Tree Indexing/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Needs Improvement \(What Was Missing\)/i)).toBeInTheDocument();
    });
  });

  describe('ComprehensiveFeedbackReport - 30-Second Summary & Candidate-Friendly Dashboard', () => {
    it('renders 30-second final candidate summary card, strengths, needs improvement, and recommendations', () => {
      const feedbackData = {
        finalScore: 82,
        verdict: 'Solid Foundations — Ready with Quick Practice',
        finalCandidateSummary: {
          interviewScore: 82,
          strongestSkill: 'Communication',
          biggestImprovementArea: 'Technical Depth',
          topRecommendations: [
            'Explain reasoning before conclusions.',
            'Use real-world examples.',
            'Discuss tradeoffs and alternatives.'
          ]
        },
        strengths: [
          { point: 'Explained ideas clearly', evidence: '"I would first optimize queries."' },
          { point: 'Good technical terminology', evidence: '"Used B-Tree indexes."' }
        ],
        needsImprovement: [
          { point: 'Did not provide implementation details', evidence: 'Omitted memory parameters.' },
          { point: 'Limited justification for decisions', evidence: 'Did not evaluate tradeoffs.' }
        ],
        whatToDoNext: [
          'Practice explaining solutions step-by-step',
          'Include real examples',
          'Discuss tradeoffs in your answers'
        ],
        qualityChecksOverall: {
          relevance: { score: 92, display: '92%', status: 'ASSESSED' },
          completeness: { score: 80, display: '80%', status: 'ASSESSED' },
          clarity: { score: 85, display: '85%', status: 'ASSESSED' },
          technicalDepth: { score: 72, display: '72%', status: 'ASSESSED' }
        },
        skillEvaluations: [
          {
            name: 'Communication',
            score: 85,
            confidence: 'High',
            reason: 'Candidate clearly explained reasoning and used structured language.',
            evidence: 'I would first optimize queries.'
          },
          {
            name: 'Technical Depth',
            score: 72,
            confidence: 'Medium',
            reason: 'Demonstrated foundational concepts.',
            evidence: 'Used B-Tree indexes.'
          }
        ]
      };

      render(
        <BrowserRouter>
          <ComprehensiveFeedbackReport feedbackData={feedbackData} sessionId="sess_test_candidate" />
        </BrowserRouter>
      );

      // 30-Second Summary
      expect(screen.getByText(/30-Second Candidate Summary/i)).toBeInTheDocument();
      expect(screen.getAllByText('Communication').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Technical Depth').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Explain reasoning before conclusions\./i)).toBeInTheDocument();
      expect(screen.getByText(/Use real-world examples\./i)).toBeInTheDocument();
      expect(screen.getByText(/Discuss tradeoffs and alternatives\./i)).toBeInTheDocument();

      // Answer Quality Checks
      expect(screen.getByText(/Answer Quality Checks/i)).toBeInTheDocument();
      expect(screen.getByText('92%')).toBeInTheDocument();

      // Strengths & Needs Improvement
      expect(screen.getByText(/Explained ideas clearly/i)).toBeInTheDocument();
      expect(screen.getByText(/Good technical terminology/i)).toBeInTheDocument();
      expect(screen.getByText(/Did not provide implementation details/i)).toBeInTheDocument();
      expect(screen.getByText(/Limited justification for decisions/i)).toBeInTheDocument();

      // What To Do Next
      expect(screen.getByText(/Practice explaining solutions step-by-step/i)).toBeInTheDocument();
    });

    it('displays relevance gate alert and suppresses detailed praise when all responses are gated', () => {
      const gatedFeedback = {
        isAllGated: true,
        finalScore: null,
        verdict: 'Assessment Inconclusive',
        gateMessage:
          'We could not accurately assess this answer because it was incomplete, unrelated, or lacked sufficient information.',
        finalCandidateSummary: {
          interviewScore: null,
          strongestSkill: 'Insufficient evidence to assess.',
          biggestImprovementArea: 'Insufficient evidence to assess.',
          topRecommendations: [
            'Explain reasoning before conclusions.',
            'Use real-world examples.',
            'Discuss tradeoffs and alternatives.'
          ]
        },
        strengths: [],
        needsImprovement: [
          { point: 'Incomplete or unassessed responses', evidence: 'Insufficient evidence to assess.' }
        ],
        whatToDoNext: [
          'Practice explaining solutions step-by-step',
          'Include real examples',
          'Discuss tradeoffs in your answers'
        ],
        qualityChecksOverall: {
          relevance: { score: 15, display: '15%', status: 'FLAGGED' },
          completeness: { score: null, display: 'Insufficient evidence to assess.', status: 'INSUFFICIENT' },
          clarity: { score: null, display: 'Insufficient evidence to assess.', status: 'INSUFFICIENT' },
          technicalDepth: { score: null, display: 'Insufficient evidence to assess.', status: 'INSUFFICIENT' }
        },
        skillEvaluations: []
      };

      render(
        <BrowserRouter>
          <ComprehensiveFeedbackReport feedbackData={gatedFeedback} sessionId="sess_test_gated" />
        </BrowserRouter>
      );

      // Relevance Notice Banner
      expect(
        screen.getAllByText(
          'We could not accurately assess this answer because it was incomplete, unrelated, or lacked sufficient information.'
        ).length
      ).toBeGreaterThanOrEqual(1);

      // Final score displays N/A
      expect(screen.getByText('N/A')).toBeInTheDocument();

      // Insufficient evidence
      expect(screen.getAllByText(/Insufficient evidence to assess\./i).length).toBeGreaterThanOrEqual(1);
    });
  });
});
