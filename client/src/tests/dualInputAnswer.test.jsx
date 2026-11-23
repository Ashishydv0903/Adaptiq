import React, { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DualInputAnswerBox from '../components/interview/DualInputAnswerBox';

// Mock sessionAPI
vi.mock('../services/api.js', () => ({
  sessionAPI: {
    uploadAnswerAudio: vi.fn().mockResolvedValue({
      data: {
        success: true,
        data: {
          transcript: 'This is a test transcript from Whisper',
          confidence: 0.94,
          language: 'english',
          speechMetrics: {
            wpm: 135,
            wpmRating: 'Ideal',
            fillerCount: 2,
            fillerRatio: 2.1,
            pauseRatio: 0.16
          },
          audioUrl: '/audio/test.webm'
        }
      }
    })
  }
}));

describe('DualInputAnswerBox Component', () => {
  it('renders correctly with default placeholder and Type mode', () => {
    const handleTelemetry = vi.fn();
    render(
      <DualInputAnswerBox
        value=""
        onChange={() => {}}
        onTelemetryChange={handleTelemetry}
        sessionId="sess_123"
        questionId="q_456"
      />
    );

    expect(screen.getByPlaceholderText(/Type your answer or click Speak/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /speak/i })).toBeInTheDocument();
    const modeBadge = screen.getByText(/Mode:/i).parentElement;
    expect(modeBadge).toHaveTextContent(/type/i);
  });

  it('allows candidate to type and triggers onChange and telemetry', () => {
    let currentValue = '';
    const handleChange = vi.fn((val) => {
      currentValue = val;
    });
    const handleTelemetry = vi.fn();

    const { rerender } = render(
      <DualInputAnswerBox
        value={currentValue}
        onChange={handleChange}
        onTelemetryChange={handleTelemetry}
        sessionId="sess_123"
      />
    );

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'In a distributed system, we need partition tolerance.' } });

    expect(handleChange).toHaveBeenCalledWith('In a distributed system, we need partition tolerance.');
    expect(handleTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        inputMode: 'type'
      })
    );

    rerender(
      <DualInputAnswerBox
        value="In a distributed system, we need partition tolerance."
        onChange={handleChange}
        onTelemetryChange={handleTelemetry}
        sessionId="sess_123"
      />
    );

    expect(screen.getByText(/8 words/i)).toBeInTheDocument();
  });

  it('disables textarea and buttons when disabled prop is true', () => {
    render(
      <DualInputAnswerBox
        value="Disabled state test"
        onChange={() => {}}
        disabled={true}
        sessionId="sess_123"
      />
    );

    const textarea = screen.getByRole('textbox');
    const speakButton = screen.getByRole('button', { name: /speak/i });

    expect(textarea).toBeDisabled();
    expect(speakButton).toBeDisabled();
  });

  it('renders clear button when value is present and resets text on confirmation', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const handleChange = vi.fn();
    const handleTelemetry = vi.fn();

    render(
      <DualInputAnswerBox
        value="Some text to clear"
        onChange={handleChange}
        onTelemetryChange={handleTelemetry}
        sessionId="sess_123"
      />
    );

    const clearButton = screen.getByRole('button', { name: /clear/i });
    expect(clearButton).toBeInTheDocument();

    fireEvent.click(clearButton);
    expect(window.confirm).toHaveBeenCalledWith('Clear answer text?');
    expect(handleChange).toHaveBeenCalledWith('');
  });

  it('renders coding explanation layout with fewer rows when isCodingExplanation is true', () => {
    render(
      <DualInputAnswerBox
        value=""
        onChange={() => {}}
        isCodingExplanation={true}
        sessionId="sess_123"
        placeholder="Explain your algorithmic approach..."
      />
    );

    const textarea = screen.getByPlaceholderText('Explain your algorithmic approach...');
    expect(textarea).toHaveAttribute('rows', '4');
  });
});
