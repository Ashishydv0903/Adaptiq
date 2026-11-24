import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MonacoCodeEditor } from '../components/interview/MonacoCodeEditor.jsx';
import { api } from '../services/api.js';

vi.mock('../services/api.js', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn()
  }
}));

vi.mock('@monaco-editor/react', () => ({
  default: ({ value, onChange }) => (
    <textarea
      data-testid="mock-monaco-editor-input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}));

describe('MonacoCodeEditor Phase R2 Execution UI Suite', () => {
  const mockQuestion = {
    _id: 'q_coding_123',
    title: 'Two Sum Target Lookup',
    prompt: 'Return two sum indices',
    language: 'javascript',
    testCases: [
      { input: '[[2,7,11,15],9]', expectedOutput: '[0,1]', isHidden: false },
      { input: '[[3,2,4],6]', expectedOutput: '[1,2]', isHidden: false }
    ],
    starterCodes: {
      javascript: 'function solution(nums, target) { return []; }',
      python: 'def solution(nums, target): return []'
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays "Local dev runner" badge when execution runs in local dev child process', async () => {
    api.post.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          execution: {
            allPassed: true,
            passedCount: 2,
            totalCount: 2,
            runtimeMs: 42,
            memoryKb: 15800,
            isFallback: true,
            sandbox: 'local-dev',
            results: [
              {
                testCaseIndex: 1,
                isHidden: false,
                input: '[[2,7,11,15],9]',
                expectedOutput: '[0,1]',
                actualOutput: '[0,1]',
                passed: true,
                status: 'Accepted',
                runtimeMs: 25,
                memoryKb: 15800
              }
            ]
          }
        }
      }
    });

    render(
      <MonacoCodeEditor
        question={mockQuestion}
        sessionId="sess_123"
        code="function solution(nums, target) { return [0,1]; }"
        onChange={vi.fn()}
        onSubmitSolution={vi.fn()}
      />
    );

    const runBtn = screen.getByRole('button', { name: /Run Sample Tests/i });
    fireEvent.click(runBtn);

    await waitFor(() => {
      expect(screen.getByTestId('local-dev-runner-badge')).toBeInTheDocument();
    });

    expect(screen.getByText(/Local dev runner/i)).toBeInTheDocument();
    expect(screen.getByText(/Accepted \(Sample Tests\)/i)).toBeInTheDocument();
  });

  it('renders "Code execution is unavailable right now. Retry, or continue without running" and controls on 503 error', async () => {
    const mockSubmitSolution = vi.fn();

    api.post.mockRejectedValueOnce({
      response: {
        status: 503,
        data: {
          code: 'EXECUTION_UNAVAILABLE',
          message: 'Code execution is unavailable right now. Retry, or continue without running.'
        }
      }
    });

    render(
      <MonacoCodeEditor
        question={mockQuestion}
        sessionId="sess_123"
        code="def solution(s): return True"
        onChange={vi.fn()}
        onSubmitSolution={mockSubmitSolution}
      />
    );

    const runBtn = screen.getByRole('button', { name: /Run Sample Tests/i });
    fireEvent.click(runBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/Code execution is unavailable right now. Retry, or continue without running./i)
      ).toBeInTheDocument();
    });

    const retryBtn = screen.getByRole('button', { name: /Retry/i });
    expect(retryBtn).toBeInTheDocument();

    const continueBtn = screen.getByRole('button', { name: /Continue without running/i });
    expect(continueBtn).toBeInTheDocument();

    // Clicking "Continue without running" passes options to onSubmitSolution
    fireEvent.click(continueBtn);
    expect(mockSubmitSolution).toHaveBeenCalledWith(
      'def solution(s): return True',
      'javascript',
      null,
      null,
      { continueWithoutRunning: true }
    );
  });
});
