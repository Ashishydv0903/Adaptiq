import { test, expect } from '@playwright/test';

test.describe('Recruiter Live Proctoring & Candidate Pipeline Journey', () => {
  test('recruiter logs in, invites candidate, monitors live sessions, and receives injected red alert', async ({ page }) => {
    // Enable demo mode query flag for demo proctor controls
    await page.goto('/login?demo=true');
    await page.waitForLoadState('networkidle');

    // 1. Log in as Recruiter
    await page.fill('input[name="email"]', 'recruiter@adaptiq.ai');
    await page.fill('input[name="password"]', 'Recruiter@123456');
    await page.click('button[type="submit"]');

    // Should redirect to recruiter dashboard
    await expect(page).toHaveURL(/\/recruiter\/dashboard/, { timeout: 15000 });
    await expect(page.locator('h1:has-text("Candidate Pipeline")')).toBeVisible({ timeout: 15000 });

    // 2. Open Live Proctoring Monitor Tab (already default or click to ensure)
    const liveMonitorTab = page.locator('button:has-text("Live Proctoring Monitor")');
    if (await liveMonitorTab.isVisible()) {
      await liveMonitorTab.click();
    }

    // 3. Verify ProctorDemoControls is mounted
    const demoControls = page.locator('[data-testid="proctor-demo-controls"]');
    await expect(demoControls).toBeVisible({ timeout: 10000 });

    // 4. Inject a simulated Red Alert (Cell Phone Prohibited Object)
    const injectPhoneBtn = page.locator('button:has-text("Inject Phone")');
    await expect(injectPhoneBtn).toBeVisible();
    await injectPhoneBtn.click();

    // 5. Verify Critical Red Alert Escalation Banner appears
    const redBanner = page.locator('text=RED ALERT ESCALATION').or(page.locator('text=Critical Proctoring Incident'));
    await expect(redBanner).toBeVisible({ timeout: 10000 });

    // Verify Red Badge and notification text
    await expect(page.locator('text=cell_phone_detected').first()).toBeVisible();

    // 6. Invite Candidate Flow
    const inviteBtn = page.locator('button:has-text("Invite Candidate")').first();
    await expect(inviteBtn).toBeVisible();
    await inviteBtn.click();

    // Fill invitation modal
    await expect(page.locator('text=Invite Candidate to AdaptIQ Assessment')).toBeVisible();
    await page.fill('input[placeholder*="Ada Lovelace"]', 'Test Candidate');
    await page.fill('input[placeholder*="candidate@domain.com"]', `candidate_invite_${Date.now()}@example.com`);

    const sendInviteBtn = page.locator('button:has-text("Dispatch Invite")');
    await sendInviteBtn.click();

    // Verify invitation confirmation
    await expect(page.locator('text=Invitation Dispatched').first()).toBeVisible({ timeout: 10000 });
  });
});
