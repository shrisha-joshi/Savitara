/**
 * E2E spec: Auth flow — login page renders, Google OAuth button present,
 * unauthenticated users are redirected from protected routes.
 *
 * These tests use Playwright's page.route() to intercept API calls so we
 * don't need a live backend.
 */
import { expect, test } from '@playwright/test';

test.describe('Auth flow', () => {
  test('login page renders with Google sign-in button', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/savitara/i);
    // Google sign-in button exposed by @react-oauth/google renders a button
    const googleBtn = page.getByRole('button', { name: /sign in with google/i });
    await expect(googleBtn).toBeVisible({ timeout: 10_000 });
  });

  test('unauthenticated user is redirected to /login from /chat', async ({ page }) => {
    // No auth token set — navigate directly to a protected route
    await page.goto('/chat');
    // Should redirect to /login
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test('login page has Savitara branding visible', async ({ page }) => {
    await page.goto('/login');
    // The app name or logo should be visible
    await expect(
      page.getByText(/savitara/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });
});
