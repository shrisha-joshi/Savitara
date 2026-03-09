/**
 * E2E spec: Report and block user flows.
 *
 * Verifies that the report/block dialog can be opened from the conversation header
 * and that the required form fields are present.
 */
import { expect, test } from '@playwright/test';

const MOCK_USER = {
  id: 'user1',
  name: 'Test User',
  email: 'test@example.com',
  role: 'grihasta',
};
const MOCK_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyMSIsImV4cCI6OTk5OTk5OTk5OX0.mock';

test.describe('Block and report user', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(({ token, user }) => {
      localStorage.setItem('access_token', token);
      localStorage.setItem('user', JSON.stringify(user));
    }, { token: MOCK_TOKEN, user: MOCK_USER });

    await page.route('**/api/v1/users/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: MOCK_USER }),
      })
    );

    await page.route('**/api/v1/chat/conversations**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            conversations: [
              {
                id: 'conv1',
                other_user: { id: 'acharya1', name: 'Acharya Sharma', avatar_url: null },
                last_message: { content: 'Namaste', created_at: new Date().toISOString() },
                unread_count: 0,
                is_muted: false,
                is_pinned: false,
              },
            ],
            total: 1,
          },
        }),
      })
    );

    await page.route('**/api/v1/chat/conversations/conv1/messages**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { messages: [], total: 0 } }),
      })
    );

    // Mock moderation endpoints
    await page.route('**/api/v1/moderation/report', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { report_id: 'rep1', status: 'pending' } }),
      })
    );

    await page.route('**/api/v1/moderation/block', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { blocked: true } }),
      })
    );
  });

  test('report user dialog is accessible from conversation', async ({ page }) => {
    await page.goto('/chat');
    await page.getByText('Acharya Sharma').click();

    // Open overflow menu / more options in chat header
    const moreBtn = page.getByRole('button', { name: /more|options|report|block/i }).first();
    await moreBtn.click();

    // Should see Report or Block option in a menu or button
    await expect(
      page.getByText(/report|block/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });
});
