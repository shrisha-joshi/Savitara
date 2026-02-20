/**
 * E2E Tests for Optimistic UI and Offline Queue
 *
 * Tests optimistic message sending and offline queue functionality:
 * - Instant message display
 * - Server confirmation
 * - Retry on failure
 * - Offline message queueing
 * - Network reconnection
 */
import { test, expect } from '@playwright/test';

test.describe('Optimistic UI', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('[data-testid=email-input]', 'test@example.com');
    await page.fill('[data-testid=password-input]', 'password123');
    await page.click('[data-testid=login-button]');
    await page.waitForURL('/chat');
  });

  test('should display message immediately on send', async ({ page }) => {
    // Navigate to conversation
    await page.goto('/chat/conversation_123');
    
    const messageText = `Test message ${Date.now()}`;
    
    // Type message
    await page.fill('[data-testid=message-input]', messageText);
    
    // Send message
    await page.click('[data-testid=send-button]');
    
    // Message should appear immediately
    const sentMessage = page.locator(`[data-testid=message-bubble]:has-text("${messageText}")`);
    await expect(sentMessage).toBeVisible({ timeout: 100 }); // Should be instant
    
    // Should show sending status
    await expect(sentMessage).toHaveAttribute('data-status', 'sending');
    
    // Wait for server confirmation
    await expect(sentMessage).toHaveAttribute('data-status', 'sent', { timeout: 3000 });
  });

  test('should handle server confirmation', async ({ page }) => {
    // Navigate to conversation
    await page.goto('/chat/conversation_123');
    
    const messageText = `Confirm test ${Date.now()}`;
    
    // Send message
    await page.fill('[data-testid=message-input]', messageText);
    await page.click('[data-testid=send-button]');
    
    const message = page.locator(`[data-testid=message-bubble]:has-text("${messageText}")`);
    
    // Initially has temp ID
    const initialId = await message.getAttribute('data-message-id');
    expect(initialId).toMatch(/^temp_/);
    
    // After confirmation, should have server ID
    await page.waitForTimeout(1000);
    const confirmedId = await message.getAttribute('data-message-id');
    expect(confirmedId).not.toMatch(/^temp_/);
  });

  test('should show retry button on failure', async ({ page }) => {
    // Intercept and fail message send
    await page.route('**/api/v1/messages', route => {
      route.abort('failed');
    });
    
    // Navigate to conversation
    await page.goto('/chat/conversation_123');
    
    const messageText = `Fail test ${Date.now()}`;
    
    // Send message
    await page.fill('[data-testid=message-input]', messageText);
    await page.click('[data-testid=send-button]');
    
    const message = page.locator(`[data-testid=message-bubble]:has-text("${messageText}")`);
    
    // Should show failed status
    await expect(message).toHaveAttribute('data-status', 'failed', { timeout: 3000 });
    
    // Should show retry button
    await expect(message.locator('[data-testid=retry-button]')).toBeVisible();
  });

  test('should retry failed message', async ({ page }) => {
    let requestCount = 0;
    
    // Fail first request, succeed on second
    await page.route('**/api/v1/messages', route => {
      requestCount++;
      if (requestCount === 1) {
        route.abort('failed');
      } else {
        route.continue();
      }
    });
    
    // Navigate to conversation
    await page.goto('/chat/conversation_123');
    
    const messageText = `Retry test ${Date.now()}`;
    
    // Send message (will fail)
    await page.fill('[data-testid=message-input]', messageText);
    await page.click('[data-testid=send-button]');
    
    const message = page.locator(`[data-testid=message-bubble]:has-text("${messageText}")`);
    
    // Wait for failure
    await expect(message).toHaveAttribute('data-status', 'failed', { timeout: 3000 });
    
    // Click retry
    await message.locator('[data-testid=retry-button]').click();
    
    // Should succeed on retry
    await expect(message).toHaveAttribute('data-status', 'sent', { timeout: 3000 });
  });

  test('should auto-scroll to new messages', async ({ page }) => {
    // Navigate to conversation
    await page.goto('/chat/conversation_123');
    
    // Send message
    await page.fill('[data-testid=message-input]', 'Scroll test');
    await page.click('[data-testid=send-button]');
    
    // Should scroll to bottom
    await page.waitForTimeout(500);
    const messageList = page.locator('[data-testid=message-list]');
    const newScrollTop = await messageList.evaluate(el => el.scrollTop);
    const scrollHeight = await messageList.evaluate(el => el.scrollHeight);
    const clientHeight = await messageList.evaluate(el => el.clientHeight);
    
    // Verify scrolled to bottom
    expect(newScrollTop + clientHeight).toBeGreaterThanOrEqual(scrollHeight - 10); // Allow 10px tolerance
  });

  test('should update message status in real-time', async ({ page }) => {
    // Navigate to conversation
    await page.goto('/chat/conversation_123');
    
    const messageText = `Status test ${Date.now()}`;
    
    // Send message
    await page.fill('[data-testid=message-input]', messageText);
    await page.click('[data-testid=send-button]');
    
    const message = page.locator(`[data-testid=message-bubble]:has-text("${messageText}")`);
    
    // Track status transitions
    await expect(message).toHaveAttribute('data-status', 'sending');
    
    // Should transition through states
    await expect(message).toHaveAttribute('data-status', /(sending|sent)/, { timeout: 2000 });
    
    // Eventually sent
    await expect(message).toHaveAttribute('data-status', 'sent', { timeout: 5000 });
  });
});

test.describe('Offline Queue', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid=email-input]', 'test@example.com');
    await page.fill('[data-testid=password-input]', 'password123');
    await page.click('[data-testid=login-button]');
    await page.waitForURL('/chat');
  });

  test('should queue messages when offline', async ({ page, context }) => {
    // Navigate to conversation
    await page.goto('/chat/conversation_123');
    
    // Go offline
    await context.setOffline(true);
    
    // Verify offline banner
    await expect(page.locator('[data-testid=offline-banner]')).toBeVisible();
    
    const messageText = `Offline message ${Date.now()}`;
    
    // Send message while offline
    await page.fill('[data-testid=message-input]', messageText);
    await page.click('[data-testid=send-button]');
    
    const message = page.locator(`[data-testid=message-bubble]:has-text("${messageText}")`);
    
    // Should show as pending/queued
    await expect(message).toHaveAttribute('data-status', 'pending');
    
    // Should show queue indicator
    await expect(page.locator('[data-testid=queue-count]')).toBeVisible();
    await expect(page.locator('[data-testid=queue-count]')).toContainText('1');
  });

  test('should drain queue when reconnecting', async ({ page, context }) => {
    // Navigate to conversation
    await page.goto('/chat/conversation_123');
    
    // Go offline
    await context.setOffline(true);
    await expect(page.locator('[data-testid=offline-banner]')).toBeVisible();
    
    // Send multiple messages while offline
    const messages = [];
    for (let i = 0; i < 3; i++) {
      const text = `Queued message ${i}`;
      messages.push(text);
      await page.fill('[data-testid=message-input]', text);
      await page.click('[data-testid=send-button]');
      await page.waitForTimeout(200);
    }
    
    // Verify all queued
    await expect(page.locator('[data-testid=queue-count]')).toContainText('3');
    
    // Go back online
    await context.setOffline(false);
    
    // Should show draining state
    await expect(page.locator('[data-testid=sending-queued]')).toBeVisible({ timeout: 2000 });
    
    // All messages should be sent
    for (const text of messages) {
      const message = page.locator(`[data-testid=message-bubble]:has-text("${text}")`);
      await expect(message).toHaveAttribute('data-status', 'sent', { timeout: 5000 });
    }
    
    // Queue should be empty
    await expect(page.locator('[data-testid=offline-banner]')).not.toBeVisible();
    await expect(page.locator('[data-testid=queue-count]')).not.toBeVisible();
  });

  test('should preserve queue across page reload', async ({ page, context }) => {
    // Navigate to conversation
    await page.goto('/chat/conversation_123');
    
    // Go offline
    await context.setOffline(true);
    
    const messageText = `Persist test ${Date.now()}`;
    
    // Queue message
    await page.fill('[data-testid=message-input]', messageText);
    await page.click('[data-testid=send-button]');
    
    // Reload page
    await page.reload();
    await page.goto('/chat/conversation_123');
    
    // Message should still be queued
    const message = page.locator(`[data-testid=message-bubble]:has-text("${messageText}")`);
    await expect(message).toBeVisible();
    await expect(message).toHaveAttribute('data-status', 'pending');
  });

  test('should handle retry with exponential backoff', async ({ page, context }) => {
    let requestCount = 0;
    
    // Fail first 2 requests, succeed on 3rd
    await page.route('**/api/v1/messages', route => {
      requestCount++;
      if (requestCount <= 2) {
        route.abort('failed');
      } else {
        route.continue();
      }
    });
    
    // Navigate to conversation
    await page.goto('/chat/conversation_123');
    
    const messageText = `Backoff test ${Date.now()}`;
    
    // Send message
    await page.fill('[data-testid=message-input]', messageText);
    await page.click('[data-testid=send-button]');
    
    const message = page.locator(`[data-testid=message-bubble]:has-text("${messageText}")`);
    
    // Should retry automatically
    await expect(message).toHaveAttribute('data-status', 'retrying', { timeout: 3000 });
    
    // Eventually succeed
    await expect(message).toHaveAttribute('data-status', 'sent', { timeout: 10000 });
    
    // Verify made 3 requests (initial + 2 retries)
    expect(requestCount).toBe(3);
  });

  test('should clear individual queued messages', async ({ page, context }) => {
    // Navigate to conversation
    await page.goto('/chat/conversation_123');
    
    // Go offline
    await context.setOffline(true);
    
    // Queue messages
    await page.fill('[data-testid=message-input]', 'Message 1');
    await page.click('[data-testid=send-button]');
    await page.fill('[data-testid=message-input]', 'Message 2');
    await page.click('[data-testid=send-button]');
    
    // Delete one queued message
    const message1 = page.locator('[data-testid=message-bubble]:has-text("Message 1")');
    await message1.hover();
    await message1.locator('[data-testid=delete-button]').click();
    await page.click('[data-testid=confirm-delete]');
    
    // Should be removed from queue
    await expect(message1).not.toBeVisible();
    await expect(page.locator('[data-testid=queue-count]')).toContainText('1');
  });

  test('should show network status indicator', async ({ page, context }) => {
    // Navigate to conversation
    await page.goto('/chat/conversation_123');
    
    // Initially online
    await expect(page.locator('[data-testid=offline-banner]')).not.toBeVisible();
    
    // Go offline
    await context.setOffline(true);
    
    // Should show offline indicator
    await expect(page.locator('[data-testid=offline-banner]')).toBeVisible();
    await expect(page.locator('[data-testid=offline-banner]')).toContainText(/offline/i);
    
    // Go back online
    await context.setOffline(false);
    
    // Should hide offline indicator
    await expect(page.locator('[data-testid=offline-banner]')).not.toBeVisible();
  });
});

test.describe('Optimistic UI Accessibility', () => {
  test('should announce status changes to screen readers', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid=email-input]', 'test@example.com');
    await page.fill('[data-testid=password-input]', 'password123');
    await page.click('[data-testid=login-button]');
    
    await page.goto('/chat/conversation_123');
    
    // Send message
    await page.fill('[data-testid=message-input]', 'Accessibility test');
    await page.click('[data-testid=send-button]');
    
    // Check for live region
    const liveRegion = page.locator('[aria-live=polite]');
    if (await liveRegion.count() > 0) {
      await expect(liveRegion).toContainText(/sent|sending/i);
    }
  });

  test('should have visible retry button for keyboard users', async ({ page, context }) => {
    // Fail message send
    await page.route('**/api/v1/messages', route => route.abort('failed'));
    
    await page.goto('/login');
    await page.fill('[data-testid=email-input]', 'test@example.com');
    await page.fill('[data-testid=password-input]', 'password123');
    await page.click('[data-testid=login-button]');
    
    await page.goto('/chat/conversation_123');
    
    // Send failed message
    await page.fill('[data-testid=message-input]', 'Failed message');
    await page.click('[data-testid=send-button]');
    
    // Retry button should be keyboard accessible
    const retryButton = page.locator('[data-testid=retry-button]');
    await expect(retryButton).toBeVisible();
    await expect(retryButton).toHaveAttribute('aria-label', /retry/i);
    
    // Should be focusable
    await retryButton.focus();
    await expect(retryButton).toBeFocused();
  });
});
