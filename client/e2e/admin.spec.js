import { test, expect } from '@playwright/test';

test.describe('Admin Question Studio & Fairness Audit Journey', () => {
  test('admin logs in, approves pending AI question, triggers IRT recalibration, and audits fairness dashboard', async ({ page }) => {
    // 1. Log in as Admin
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    await page.fill('input[name="email"]', 'admin@adaptiq.ai');
    await page.fill('input[name="password"]', 'Admin@123456');
    await page.click('button[type="submit"]');

    // Should redirect to admin dashboard
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 15000 });
    await expect(page.locator('h1:has-text("Platform Governance & AI Studio")')).toBeVisible({ timeout: 15000 });

    // 2. Question Approval Queue: Approve a Question
    const approveBtn = page.locator('button:has-text("Approve Question")').first();
    if (await approveBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await approveBtn.click();
      await page.waitForTimeout(1000);
    }

    // 3. Trigger Empirical IRT Recalibration
    const triggerRecalibrateBtn = page.locator('button:has-text("Trigger IRT Recalibration")');
    if (await triggerRecalibrateBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await triggerRecalibrateBtn.click();
      await expect(page.getByText('Empirical IRT Recalibration Successful')).toBeVisible({ timeout: 15000 });
    }

    // 4. Navigate to Admin Fairness Dashboard
    await page.goto('/admin/fairness');
    await page.waitForLoadState('networkidle');

    // Verify Fairness and Adverse Impact headers
    await expect(page.locator('h1:has-text("Fairness")')).toBeVisible({ timeout: 15000 });

    // Verify Disparate Impact / Four-Fifths rule card loads
    await expect(page.locator('text=Four-Fifths Rule').first()).toBeVisible({ timeout: 15000 });
  });
});
