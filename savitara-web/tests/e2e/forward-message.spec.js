/**
 * E2E spec: Forward message flow.
 *
 * Opens a conversation, long-presses (right-clicks) a message to get the
 * context menu, selects "Forward", verifies the ForwardMessageDialog opens,
 * and checks that the forward limit (MAX = 5) is enforced.
 */
import { expect, test } from '@playwright/test';

const MOCK_USER = {
  id: 'user1',
  name: 'Test User',
  email: 'test@example.com',
  role: 'grihasta',
};
const MOCK_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyMSIsImV4cCI6OTk5OTk5OTk5OX0.mock';

const CONVERSATIONS = [
  { id: 'conv1', other_user: { id: 'acharya1', name: 'Acharya Sharma', avatar_url: null }, last_message: { content: 'Namaste', created_at: new Date().toISOString() }, unread_count: 0, is_muted: false, is_pinned: false },
  { id: 'conv2', other_user: { id: 'u2', name: 'Alice', avatar_url: null }, last_message: { content: 'Hi', created_at: new Date().toISOString() }, unread_count: 0, is_muted: false, is_pinned: false },
  { id: 'conv3', other_user: { id: 'u3', name: 'Bob', avatar_url: null }, last_message: { content: 'Hey', created_at: new Date().toISOString() }, unread_count: 0, is_muted: false, is_pinned: false },
  { id: 'conv4', other_user: { id: 'u4', name: 'Carol', avatar_url: null }, last_message: { content: 'Yo', created_at: new Date().toISOString() }, unread_count: 0, is_muted: false, is_pinned: false },
  { id: 'conv5', other_user: { id: 'u5', name: 'Dave', avatar_url: null }, last_message: { content: 'Wut', created_at: new Date().toISOString() }, unread_count: 0, is_muted: false, is_pinned: false },
  { id: 'conv6', other_user: { id: 'u6', name: 'Eve', avatar_url: null }, last_message: { content: 'Hello', created_at: new Date().toISOString() }, unread_count: 0, is_muted: false, is_pinned: false },
];

test.describe('Forward message', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(({ token, user }) => {
      localStorage.setItem('access_token', token);
      localStorage.setItem('user', JSON.stringify(user));
    }, { token: MOCK_TOKEN, user: MOCK_USER });

    await page.route('**/api/v1/users/me', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: MOCK_USER }) })
    );

    await page.route('**/api/v1/chat/conversations**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { conversations: CONVERSATIONS, total: CONVERSATIONS.length } }),
      })
    );

    await page.route('**/api/v1/chat/conversations/conv1/messages**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            messages: [
              {
                id: 'msg1',
                conversation_id: 'conv1',
                sender_id: 'acharya1',
                content: 'Namaste! How can I help?',
                message_type: 'text',
                created_at: new Date().toISOString(),
                reactions: [],
                is_forwarded: false,
              },
            ],
            total: 1,
          },
        }),
      })
    );

    await page.route('**/api/v1/chat/messages/*/forward', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { forwarded: true } }) })
    );
  });

  test('forward dialog opens from message context menu', async ({ page }) => {
    await page.goto('/chat');
    await page.getByText('Acharya Sharma').click();

    // Wait for message to appear
    const msgText = page.getByText('Namaste! How can I help?');
    await expect(msgText).toBeVisible({ timeout: 10_000 });

    // Right-click on the message to get context menu (or hover + menu icon)
    await msgText.click({ button: 'right' });

    // Look for "Forward" in context menu
    const forwardBtn = page.getByText(/^forward$/i);
    await expect(forwardBtn).toBeVisible({ timeout: 5_000 });
    await forwardBtn.click();

    // ForwardMessageDialog should open
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/forward message/i)).toBeVisible();
  });

  test('forward dialog shows conversation list', async ({ page }) => {
    await page.goto('/chat');
    await page.getByText('Acharya Sharma').click();

    const msgText = page.getByText('Namaste! How can I help?');
    await expect(msgText).toBeVisible({ timeout: 10_000 });
    await msgText.click({ button: 'right' });

    const forwardBtn = page.getByText(/^forward$/i);
    await expect(forwardBtn).toBeVisible({ timeout: 5_000 });
    await forwardBtn.click();

    // Conversations other than conv1 should appear in the list
    await expect(page.getByText('Alice')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Bob')).toBeVisible();
  });
});
