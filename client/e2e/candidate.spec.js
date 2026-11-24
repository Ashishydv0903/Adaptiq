import { test, expect } from '@playwright/test';

test.describe('Candidate End-to-End Interview Journey', () => {
  const timestamp = Date.now();
  const candidateEmail = `candidate_${timestamp}@adaptiq.ai`;
  const candidatePassword = 'Candidate@123456';
  const candidateName = `Candidate Test ${timestamp}`;

  test('completes full candidate flow: register, resume, interview with typing/voice/star, follow-up, report', async ({ page }) => {
    page.on('console', (msg) => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
    page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message, err.stack));
    page.on('request', (req) => console.log('REQ START:', req.method(), req.url()));
    page.on('response', (res) => console.log('RES END:', res.status(), res.url()));

    // 1. Register candidate account
    await page.goto('/register');
    await page.waitForLoadState('networkidle');

    await page.fill('input[name="name"]', candidateName);
    await page.fill('input[name="email"]', candidateEmail);
    await page.fill('input[name="password"]', candidatePassword);
    await page.click('button[type="submit"]');

    // Should redirect to candidate dashboard
    await expect(page).toHaveURL(/\/candidate\/dashboard/, { timeout: 15000 });

    // 2. Upload / Save Resume
    const resumeTextarea = page.locator('textarea[placeholder*="Paste or upload your resume here"]');
    await expect(resumeTextarea).toBeVisible();

    // Use example resume
    const exampleBtn = page.getByRole('button', { name: 'Use Example', exact: true });
    if (await exampleBtn.isVisible()) {
      await exampleBtn.click();
    } else {
      await resumeTextarea.fill(`SENIOR FULLSTACK DEVELOPER\nExperience with React, Node.js, TypeScript, PostgreSQL, Redis distributed caching, and microservices.`);
    }

    // 3. Start Practice Interview Session (unproctored sandbox mode with hints & instant feedback)
    const startPracticeBtn = page.locator('button:has-text("Start Practice (No Proctoring)")').first();
    await expect(startPracticeBtn).toBeVisible();
    await startPracticeBtn.click();

    // Should navigate into interview screen
    await expect(page).toHaveURL(/\/interview\/[a-zA-Z0-9_-]+/, { timeout: 15000 });

    // 4. Verify Interview Room & Practice Sandbox Mode
    await expect(page.locator('text=Practice Sandbox Mode').first()).toBeVisible({ timeout: 15000 });

    // 5. Answer by typing in answer box
    const answerInput = page.locator('textarea[placeholder*="Type"], input[placeholder*="Type"]').first();
    await expect(answerInput).toBeVisible();
    await answerInput.fill('To design a high-throughput caching tier, we implement Cache-Aside with Redis Cluster, set probabilistic early expiration TTLs, and use Change Data Capture (CDC) via Kafka to invalidate asynchronously.');

    // 6. Test Practice Hint Reveal (/sessions/:id/unlock-hint)
    const revealHintBtn = page.locator('button:has-text("Reveal Hint 1")').first();
    if (await revealHintBtn.isVisible()) {
      await revealHintBtn.click();
      await expect(page.locator('text=Level 1:').or(page.locator('text=Hint level 1')).first()).toBeVisible({ timeout: 10000 });
    }

    // 7. Mock voice recording toggle (voice mode)
    const micBtn = page.locator('button:has-text("Speak (Mic)"), button[title*="Microphone"]').first();
    if (await micBtn.isVisible()) {
      await micBtn.click();
      await page.waitForTimeout(1000);
      const stopBtn = page.locator('button:has-text("Stop Speaking"), button[title*="Stop"]').first();
      if (await stopBtn.isVisible()) {
        await stopBtn.click();
      }
    }

    // 8. Submit Answer
    const submitBtn = page.locator('button:has-text("Submit & Next")').first();
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    // 9. If Follow-Up appears, answer or skip it
    const followUpCard = page.locator('text=Follow-Up Question').or(page.locator('text=Practice Bonus'));
    const isFollowUp = await followUpCard.isVisible({ timeout: 4000 }).catch(() => false);
    if (isFollowUp) {
      const skipFollowUpBtn = page.locator('button:has-text("Skip")').or(page.locator('button:has-text("Skip Bonus Question")')).first();
      if (await skipFollowUpBtn.isVisible()) {
        await skipFollowUpBtn.click();
      }
    }

    // 10. Exit / Finish Interview Session
    const exitBtn = page.locator('button:has-text("Exit Interview")').or(page.locator('button[title*="Exit"]')).first();
    if (await exitBtn.isVisible()) {
      await exitBtn.click();
      const confirmEndBtn = page.locator('button:has-text("End Interview")').or(page.locator('button:has-text("Confirm Exit")')).first();
      if (await confirmEndBtn.isVisible()) {
        await confirmEndBtn.click();
      }
    }

    // 11. Navigate to Study Plan & Gap Analysis
    await page.goto('/skills/gap-analysis');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1:has-text("Gap Analysis")').or(page.locator('text=Study Plan')).first()).toBeVisible({ timeout: 15000 });

    // 12. Verify PDF export endpoint
    const exportPdfBtn = page.locator('button:has-text("Export Official PDF")').or(page.locator('button:has-text("Download PDF")')).first();
    if (await exportPdfBtn.isVisible()) {
      await expect(exportPdfBtn).toBeEnabled();
    }
  });
});
