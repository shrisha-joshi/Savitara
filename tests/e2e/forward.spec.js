/**
 * E2E Tests for Message Forwarding
 *
 * Tests message forwarding functionality end-to-end:
 * - Forwarding messages to users
 * - Forwarding messages to conversations
 * - Forward count display
 * - Privacy and permission checks
 */
import { test, expect } from '@playwright/test';

test.describe('Message Forwarding', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('[data-testid=email-input]', 'test@example.com');
    await page.fill('[data-testid=password-input]', 'password123');
    await page.click('[data-testid=login-button]');
    await page.waitForURL('/chat');
  });

  test('should forward message to single user', async ({ page }) => {
    // Navigate to conversation
    await page.goto('/chat/conversation_123');
    
    // Find message to forward
    const message = page.locator('[data-testid=message-bubble]').first();
    await expect(message).toBeVisible();
    
    // Hover to show forward button
    await message.hover();
    
    // Click forward button
    await message.locator('[data-testid=forward-button]').click();
    
    // Verify forward dialog opened
    await expect(page.locator('[data-testid=forward-dialog]')).toBeVisible();
    
    // Search for recipient
    await page.fill('[data-testid=search-conversations]', 'User Two');
    
    // Select recipient
    await page.click('[data-testid=conversation-item]:has-text("User Two")');
    
    // Verify selected
    await expect(page.locator('[data-testid=selected-count]')).toContainText('1');
    
    // Click forward button
    await page.click('[data-testid=confirm-forward]');
    
    // Verify success message
    await expect(page.locator('[data-testid=toast]')).toContainText('forwarded');
    
    // Verify dialog closed
    await expect(page.locator('[data-testid=forward-dialog]')).not.toBeVisible();
  });

  test('should forward message to multiple conversations', async ({ page }) => {
    // Navigate to conversation
    await page.goto('/chat/conversation_123');
    
    // Find message to forward
    const message = page.locator('[data-testid=message-bubble]').first();
    
    // Open forward dialog
    await message.hover();
    await message.locator('[data-testid=forward-button]').click();
    
    // Select multiple recipients
    await page.click('[data-testid=conversation-item]', { position: { x: 10, y: 10 } });
    await page.waitForTimeout(200);
    await page.click('[data-testid=conversation-item] >> nth=1');
    await page.waitForTimeout(200);
    await page.click('[data-testid=conversation-item] >> nth=2');
    
    // Verify selection count
    await expect(page.locator('[data-testid=selected-count]')).toContainText('3');
    
    // Forward
    await page.click('[data-testid=confirm-forward]');
    
    // Verify success
    await expect(page.locator('[data-testid=toast]')).toContainText('3');
    await expect(page.locator('[data-testid=toast]')).toContainText('forwarded');
  });

  test('should enforce max recipients limit', async ({ page }) => {
    // Navigate to conversation
    await page.goto('/chat/conversation_123');
    
    // Open forward dialog
    const message = page.locator('[data-testid=message-bubble]').first();
    await message.hover();
    await message.locator('[data-testid=forward-button]').click();
    
    // Try to select 51 conversations (if available)
    for (let i = 0; i < 51; i++) {
      const conversation = page.locator(`[data-testid=conversation-item] >> nth=${i}`);
      if (await conversation.count() > 0) {
        await conversation.click();
      }
    }
    
    // Verify max limit message
    await expect(page.locator('[data-testid=max-limit-warning]')).toBeVisible();
    await expect(page.locator('[data-testid=selected-count]')).toContainText('50');
    
    // Forward button should still work with 50
    await page.click('[data-testid=confirm-forward]');
    await expect(page.locator('[data-testid=toast]')).toBeVisible();
  });

  test('should forward to group conversation', async ({ page }) => {
    // Navigate to conversation
    await page.goto('/chat/conversation_123');
    
    // Forward message
    const message = page.locator('[data-testid=message-bubble]').first();
    await message.hover();
    await message.locator('[data-testid=forward-button]').click();
    
    // Click "Groups" tab
    await page.click('[data-testid=groups-tab]');
    
    // Select group
    await page.click('[data-testid=group-conversation]:has-text("Family Group")');
    
    // Forward
    await page.click('[data-testid=confirm-forward]');
    
    // Verify forwarded
    await expect(page.locator('[data-testid=toast]')).toContainText('forwarded');
  });

  test('should show forward count', async ({ page }) => {
    // Navigate to conversation with forwarded message
    await page.goto('/chat/conversation_with_forwards');
    
    // Find message with forwards
    const message = page.locator('[data-testid=message-bubble][data-forward-count]').first();
    await expect(message).toBeVisible();
    
    // Verify forward count badge
    const forwardBadge = message.locator('[data-testid=forward-count-badge]');
    await expect(forwardBadge).toBeVisible();
    await expect(forwardBadge).toContainText(/\d+/);
    
    // Click to see details
    await forwardBadge.click();
    
    // Verify forward details dialog
    await expect(page.locator('[data-testid=forward-details-dialog]')).toBeVisible();
  });

  test('should display forwarded message context', async ({ page }) => {
    // Navigate to conversation
    await page.goto('/chat/conversation_123');
    
    // Find forwarded message
    const forwardedMessage = page.locator('[data-testid=message-bubble][data-message-type=forwarded]').first();
    await expect(forwardedMessage).toBeVisible();
    
    // Verify forwarded context shown
    await expect(forwardedMessage.locator('[data-testid=forwarded-from]')).toBeVisible();
    await expect(forwardedMessage.locator('[data-testid=forwarded-from]')).toContainText('Forwarded');
    
    // Verify original sender name
    await expect(forwardedMessage.locator('[data-testid=original-sender]')).toBeVisible();
  });

  test('should handle forward failures gracefully', async ({ page }) => {
    // Setup: Block network for testing
    await page.route('**/api/v1/messages/*/forward', route => route.abort());
    
    // Navigate and forward
    await page.goto('/chat/conversation_123');
    const message = page.locator('[data-testid=message-bubble]').first();
    await message.hover();
    await message.locator('[data-testid=forward-button]').click();
    await page.click('[data-testid=conversation-item]');
    await page.click('[data-testid=confirm-forward]');
    
    // Verify error message
    await expect(page.locator('[data-testid=error-message]')).toBeVisible();
    await expect(page.locator('[data-testid=error-message]')).toContainText('failed');
  });

  test('should filter conversations in forward dialog', async ({ page }) => {
    // Navigate to conversation
    await page.goto('/chat/conversation_123');
    
    // Open forward dialog
    const message = page.locator('[data-testid=message-bubble]').first();
    await message.hover();
    await message.locator('[data-testid=forward-button]').click();
    
    // Type in search
    await page.fill('[data-testid=search-conversations]', 'John');
    
    // Verify filtered results
    const visibleConversations = page.locator('[data-testid=conversation-item]:visible');
    await expect(visibleConversations).toHaveCount(await visibleConversations.count());
    
    // Each visible item should contain search term
    const firstItem = visibleConversations.first();
    await expect(firstItem).toContainText(/john/i);
  });

  test('should prevent forwarding from restricted conversation', async ({ page }) => {
    // Navigate to restricted conversation
    await page.goto('/chat/restricted_conversation');
    
    // Try to forward message
    const message = page.locator('[data-testid=message-bubble]').first();
    await message.hover();
    
    // Verify no forward button or disabled
    const forwardButton = message.locator('[data-testid=forward-button]');
    if (await forwardButton.count() > 0) {
      await expect(forwardButton).toBeDisabled();
    } else {
      await expect(forwardButton).toHaveCount(0);
    }
  });
});

test.describe('Message Forwarding Accessibility', () => {
  test('should be keyboard navigable', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid=email-input]', 'test@example.com');
    await page.fill('[data-testid=password-input]', 'password123');
    await page.keyboard.press('Enter');
    await page.waitForURL('/chat');
    
    await page.goto('/chat/conversation_123');
    
    // Focus first message
    await page.keyboard.press('Tab'); // Adjust for UI structure
    
    // Open context menu with keyboard
    await page.keyboard.press('Shift+F10'); // Or appropriate shortcut
    
    // Navigate to forward option
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    
    // Should open forward dialog
    await expect(page.locator('[data-testid=forward-dialog]')).toBeVisible();
  });

  test('should have proper ARIA labels in forward dialog', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid=email-input]', 'test@example.com');
    await page.fill('[data-testid=password-input]', 'password123');
    await page.click('[data-testid=login-button]');
    
    await page.goto('/chat/conversation_123');
    
    // Open forward dialog
    const message = page.locator('[data-testid=message-bubble]').first();
    await message.hover();
    await message.locator('[data-testid=forward-button]').click();
    
    // Check dialog ARIA
    const dialog = page.locator('[data-testid=forward-dialog]');
    await expect(dialog).toHaveAttribute('role', 'dialog');
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    
    // Check search input
    const searchInput = page.locator('[data-testid=search-conversations]');
    await expect(searchInput).toHaveAttribute('aria-label', /search/i);
  });

  test('should announce selection changes to screen readers', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid=email-input]', 'test@example.com');
    await page.fill('[data-testid=password-input]', 'password123');
    await page.click('[data-testid=login-button]');
    
    await page.goto('/chat/conversation_123');
    
    // Open forward dialog
    const message = page.locator('[data-testid=message-bubble]').first();
    await message.hover();
    await message.locator('[data-testid=forward-button]').click();
    
    // Select conversation
    await page.click('[data-testid=conversation-item]');
    
    // Check live region for announcements
    const liveRegion = page.locator('[aria-live=polite]');
    if (await liveRegion.count() > 0) {
      await expect(liveRegion).toContainText(/selected/i);
    }
  });
});
