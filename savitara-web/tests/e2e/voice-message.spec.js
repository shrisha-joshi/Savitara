/**
 * E2E spec: Voice message UI.
 *
 * Verifies that the voice recorder button is visible in the message composer
 * and that clicking it transitions to the recording state.
 *
 * MediaRecorder is not available in Chromium by default during testing;
 * the test uses page.addInitScript to stub it.
 */
import { expect, test } from '@playwright/test';

const MOCK_USER = {
  id: 'user1',
  name: 'Test User',
  email: 'test@example.com',
  role: 'grihasta',
};
const MOCK_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyMSIsImV4cCI6OTk5OTk5OTk5OX0.mock';

test.describe('Voice message UI', () => {
  test.beforeEach(async ({ page }) => {
    // Inject auth
    await page.addInitScript(({ token, user }) => {
      localStorage.setItem('access_token', token);
      localStorage.setItem('user', JSON.stringify(user));
    }, { token: MOCK_TOKEN, user: MOCK_USER });

    // Stub MediaRecorder and getUserMedia so the recording flow doesn't show an error
    await page.addInitScript(() => {
      const fakeStream = {
        getTracks: () => [{ stop: () => {} }],
      };
      navigator.mediaDevices = {
        getUserMedia: () => Promise.resolve(fakeStream),
      };
      class FakeMediaRecorder {
        constructor() { this.state = 'inactive'; }
        start() { this.state = 'recording'; if (this.onstart) this.onstart(); }
        stop() { this.state = 'inactive'; if (this.onstop) this.onstop(); }
        addEventListener() {}
        removeEventListener() {}
      }
      FakeMediaRecorder.isTypeSupported = () => true;
      window.MediaRecorder = FakeMediaRecorder;
    });

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
  });

  test('voice recorder button is visible in message composer', async ({ page }) => {
    await page.goto('/chat');
    await page.getByText('Acharya Sharma').click();

    // The VoiceRecorder component renders a mic icon button
    const micBtn = page.getByRole('button', { name: /record voice message/i });
    await expect(micBtn).toBeVisible({ timeout: 10_000 });
  });

  test('clicking mic button shows stop/cancel recording controls', async ({ page }) => {
    await page.goto('/chat');
    await page.getByText('Acharya Sharma').click();

    const micBtn = page.getByRole('button', { name: /record voice message/i });
    await expect(micBtn).toBeVisible({ timeout: 10_000 });
    await micBtn.click();

    // After clicking, recording UI should appear with stop button
    await expect(
      page.getByRole('button', { name: /stop recording/i })
    ).toBeVisible({ timeout: 10_000 });
  });
});
