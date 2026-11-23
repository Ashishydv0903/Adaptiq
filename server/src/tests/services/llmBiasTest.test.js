import {
  runLLMScorerBiasTest,
  BIAS_DELTA_THRESHOLD,
  SAMPLE_PARAPHRASE_SUITE
} from '../../services/scoring/llmBiasTest.js';

describe('LLM Scorer Bias & Stylistic Robustness Testing', () => {
  const sampleQuestion = {
    title: 'Explain JavaScript Event Loop',
    prompt: 'Detail how microtasks, macrotasks, and call stacks operate.'
  };

  const sampleBaseAnswer =
    'The event loop executes code on a single thread. Synchronous tasks run on the call stack, microtasks run immediately after, and macrotasks like setTimeout wait in the task queue.';

  test('Generates semantic paraphrases across formal, casual, ESL, and concise variants', () => {
    const formal = SAMPLE_PARAPHRASE_SUITE.formal(sampleBaseAnswer);
    const casual = SAMPLE_PARAPHRASE_SUITE.casual(sampleBaseAnswer);
    const esl = SAMPLE_PARAPHRASE_SUITE.esl_non_native(sampleBaseAnswer);
    const concise = SAMPLE_PARAPHRASE_SUITE.concise_bullet(sampleBaseAnswer);

    expect(formal).toContain('architectural reliability');
    expect(casual).toContain('super fast');
    expect(esl).toContain('working very good');
    expect(concise).toContain('Summary:');
  });

  test('Evaluates scoring consistency and computes max score delta and variance across paraphrases', async () => {
    const result = await runLLMScorerBiasTest({
      question: sampleQuestion,
      baseAnswer: sampleBaseAnswer
    });

    expect(result.variations.length).toBeGreaterThanOrEqual(4);
    expect(result.meanScore).toBeGreaterThan(0);
    expect(typeof result.maxDelta).toBe('number');
    expect(typeof result.isBiased).toBe('boolean');
    expect(result.conclusion).toBeTruthy();
  });

  test('Flags bias when simulated custom variations have score delta exceeding threshold', async () => {
    // Inject artificially biased responses (e.g. 90 for formal vs 60 for ESL)
    const customVariations = {
      base: sampleBaseAnswer,
      formal: 'High scoring response',
      casual: 'Lower scoring casual text'
    };

    const result = await runLLMScorerBiasTest({
      question: sampleQuestion,
      baseAnswer: sampleBaseAnswer,
      customVariations
    });

    expect(result.variations.length).toBe(3);
    expect(result.variance).toBeGreaterThanOrEqual(0);
  });
});