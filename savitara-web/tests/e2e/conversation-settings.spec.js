/**
 * E2E spec: Pin / Mute conversation settings.
 *
 * Verifies that the ConversationSettings dialog can be opened from the chat header
 * and that pin/mute controls are present and interactive.
 */
import { expect, test } from '@playwright/test';

const MOCK_USER = {
  id: 'user1',
  name: 'Test User',
  email: 'test@example.com',
  role: 'grihasta',
};
const MOCK_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyMSIsImV4cCI6OTk5OTk5OTk5OX0.mock';

test.describe('Conversation settings (pin / mute)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(({ token, user }) => {
      localStorage.setItem('access_token', token);
      localStorage.setItem('user', JSON.stringify(user));
    }, { token: MOCK_TOKEN, user: MOCK_USER });

    // Mock /api/v1/users/me
    await page.route('**/api/v1/users/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: MOCK_USER }),
      })
    );

    // Mock conversations
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

    // Mock messages
    await page.route('**/api/v1/chat/conversations/conv1/messages**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { messages: [], total: 0 } }),
      })
    );

    // Mock settings GET
    await page.route('**/api/v1/chat/conversations/conv1/settings', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            is_muted: false,
            muted_until: null,
            is_pinned: false,
            is_archived: false,
          },
        }),
      })
    );

    // Mock settings PATCH
    await page.route('**/api/v1/chat/conversations/conv1/settings', (route) => {
      if (route.request().method() === 'PATCH') {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: {} }) });
      } else {
        route.fallback();
      }
    });
  });

  test('settings dialog opens with pin and mute controls', async ({ page }) => {
    await page.goto('/chat');
    await page.getByText('Acharya Sharma').click();

    // Open settings — look for a settings / info icon in the chat header
    const settingsBtn = page.getByRole('button', { name: /settings|info|more/i }).first();
    await settingsBtn.click();

    // Dialog with "Conversation Settings" or user name should be visible
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10_000 });

    // Pin and Mute controls should be present
    await expect(page.getByText(/pin/i)).toBeVisible();
    await expect(page.getByText(/mute/i)).toBeVisible();
  });

  test('mute duration picker shows 5 options', async ({ page }) => {
    await page.goto('/chat');
    await page.getByText('Acharya Sharma').click();

    const settingsBtn = page.getByRole('button', { name: /settings|info|more/i }).first();
    await settingsBtn.click();

    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10_000 });

    // Click the Mute button to open duration picker
    await page.getByRole('button', { name: /^mute$/i }).click();

    // Expect the 5 duration options
    await expect(page.getByText('1 hour')).toBeVisible();
    await expect(page.getByText('8 hours')).toBeVisible();
    await expect(page.getByText('1 day')).toBeVisible();
    await expect(page.getByText('1 week')).toBeVisible();
    await expect(page.getByText('Indefinitely')).toBeVisible();
  });
});
