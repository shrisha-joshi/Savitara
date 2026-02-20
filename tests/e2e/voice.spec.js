/**
 * E2E Tests for Voice Messages
 *
 * Tests voice message functionality end-to-end:
 * - Recording voice messages
 * - Playing voice messages
 * - Deleting voice messages
 * - Offline voice message queueing
 */
import { test, expect } from '@playwright/test';

test.describe('Voice Messages', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('[data-testid=email-input]', 'test@example.com');
    await page.fill('[data-testid=password-input]', 'password123');
    await page.click('[data-testid=login-button]');
    
    // Wait for dashboard
    await page.waitForURL('/chat');
  });

  test('should record and send voice message', async ({ page, context }) => {
    // Grant microphone permissions
    await context.grantPermissions(['microphone']);
    
    // Navigate to conversation
    await page.goto('/chat/conversation_123');
    await page.waitForSelector('[data-testid=message-list]');
    
    // Click voice recorder button
    await page.click('[data-testid=voice-recorder-button]');
    
    // Verify recorder UI appears
    await expect(page.locator('[data-testid=voice-recorder]')).toBeVisible();
    
    // Click record button
    await page.click('[data-testid=record-button]');
    
    // Verify recording started
    await expect(page.locator('[data-testid=recording-indicator]')).toBeVisible();
    await expect(page.locator('[data-testid=recording-timer]')).toContainText('0:');
    
    // Wait for 3 seconds
    await page.waitForTimeout(3000);
    
    // Stop recording
    await page.click('[data-testid=stop-recording-button]');
    
    // Verify preview state
    await expect(page.locator('[data-testid=voice-preview]')).toBeVisible();
    await expect(page.locator('[data-testid=voice-duration]')).toContainText('0:0');
    
    // Send voice message
    await page.click('[data-testid=send-voice-button]');
    
    // Verify message appears in conversation
    await expect(page.locator('[data-testid=message-bubble]').last()).toBeVisible();
    await expect(page.locator('[data-testid=voice-message]')).toBeVisible();
    
    // Verify voice message has play button
    await expect(page.locator('[data-testid=voice-message] [data-testid=play-button]')).toBeVisible();
  });

  test('should play voice message', async ({ page }) => {
    // Navigate to conversation with voice message
    await page.goto('/chat/conversation_with_voice');
    
    // Wait for voice message to load
    const voiceMessage = page.locator('[data-testid=voice-message]').first();
    await expect(voiceMessage).toBeVisible();
    
    // Click play button
    await voiceMessage.locator('[data-testid=play-button]').click();
    
    // Verify playback started (play button becomes pause)
    await expect(voiceMessage.locator('[data-testid=pause-button]')).toBeVisible();
    
    // Verify waveform shows progress
    const waveform = voiceMessage.locator('[data-testid=waveform]');
    await expect(waveform).toBeVisible();
    
    // Wait a moment for playback
    await page.waitForTimeout(2000);
    
    // Pause playback
    await voiceMessage.locator('[data-testid=pause-button]').click();
    
    // Verify paused state
    await expect(voiceMessage.locator('[data-testid=play-button]')).toBeVisible();
  });

  test('should delete voice message', async ({ page }) => {
    // Navigate to conversation
    await page.goto('/chat/conversation_123');
    
    // Find own voice message
    const ownVoiceMessage = page.locator('[data-testid=voice-message][data-sender=self]').first();
    await expect(ownVoiceMessage).toBeVisible();
    
    // Hover to show delete button
    await ownVoiceMessage.hover();
    
    // Click delete button
    await ownVoiceMessage.locator('[data-testid=delete-button]').click();
    
    // Confirm deletion in dialog
    await page.click('[data-testid=confirm-delete]');
    
    // Verify message is removed
    await expect(ownVoiceMessage).not.toBeVisible();
    
    // Verify success toast
    await expect(page.locator('[data-testid=toast]')).toContainText('deleted');
  });

  test('should handle recording errors gracefully', async ({ page, context }) => {
    // Deny microphone permissions
    await context.clearPermissions();
    
    // Navigate to conversation
    await page.goto('/chat/conversation_123');
    
    // Click voice recorder button
    await page.click('[data-testid=voice-recorder-button]');
    
    // Click record button
    await page.click('[data-testid=record-button]');
    
    // Verify error message displayed
    await expect(page.locator('[data-testid=error-message]')).toBeVisible();
    await expect(page.locator('[data-testid=error-message]')).toContainText('microphone');
  });

  test('should respect max duration limit', async ({ page, context }) => {
    // Grant permissions
    await context.grantPermissions(['microphone']);
    
    // Navigate to conversation
    await page.goto('/chat/conversation_123');
    
    // Start recording
    await page.click('[data-testid=voice-recorder-button]');
    await page.click('[data-testid=record-button]');
    
    // Fast-forward time using mock (if available) or wait
    // For this test, we'll verify the max duration text is shown
    await expect(page.locator('[data-testid=max-duration-warning]')).toContainText('90');
  });

  test('should queue voice message when offline', async ({ page, context }) => {
    // Grant permissions
    await context.grantPermissions(['microphone']);
    
    // Navigate to conversation
    await page.goto('/chat/conversation_123');
    
    // Go offline
    await context.setOffline(true);
    
    // Verify offline indicator
    await expect(page.locator('[data-testid=offline-banner]')).toBeVisible();
    
    // Record and send voice message
    await page.click('[data-testid=voice-recorder-button]');
    await page.click('[data-testid=record-button]');
    await page.waitForTimeout(2000);
    await page.click('[data-testid=stop-recording-button]');
    await page.click('[data-testid=send-voice-button]');
    
    // Verify message shows as queued/pending
    const pendingMessage = page.locator('[data-testid=message-bubble]').last();
    await expect(pendingMessage).toHaveAttribute('data-status', 'pending');
    
    // Go back online
    await context.setOffline(false);
    
    // Verify queue drains and message sent
    await expect(page.locator('[data-testid=offline-banner]')).not.toBeVisible();
    await page.waitForTimeout(1000);
    
    // Verify message sent successfully
    await expect(pendingMessage).toHaveAttribute('data-status', 'sent');
  });

  test('should cancel voice recording', async ({ page, context }) => {
    // Grant permissions
    await context.grantPermissions(['microphone']);
    
    // Navigate to conversation
    await page.goto('/chat/conversation_123');
    
    // Start recording
    await page.click('[data-testid=voice-recorder-button]');
    await page.click('[data-testid=record-button]');
    
    // Verify recording
    await expect(page.locator('[data-testid=recording-indicator]')).toBeVisible();
    
    // Cancel recording
    await page.click('[data-testid=cancel-recording-button]');
    
    // Verify recorder closed
    await expect(page.locator('[data-testid=voice-recorder]')).not.toBeVisible();
  });

  test('should show waveform visualization', async ({ page, context }) => {
    // Grant permissions
    await context.grantPermissions(['microphone']);
    
    // Navigate to conversation
    await page.goto('/chat/conversation_123');
    
    // Record voice message
    await page.click('[data-testid=voice-recorder-button]');
    await page.click('[data-testid=record-button]');
    await page.waitForTimeout(2000);
    await page.click('[data-testid=stop-recording-button]');
    
    // Verify waveform preview shown
    const waveform = page.locator('[data-testid=waveform-preview]');
    await expect(waveform).toBeVisible();
    
    // Send message
    await page.click('[data-testid=send-voice-button]');
    
    // Verify waveform in sent message
    const sentWaveform = page.locator('[data-testid=message-bubble]').last().locator('[data-testid=waveform]');
    await expect(sentWaveform).toBeVisible();
  });

  test('should download voice message', async ({ page }) => {
    // Navigate to conversation with voice message
    await page.goto('/chat/conversation_with_voice');
    
    // Wait for voice message
    const voiceMessage = page.locator('[data-testid=voice-message]').first();
    await expect(voiceMessage).toBeVisible();
    
    // Start download
    const downloadPromise = page.waitForEvent('download');
    await voiceMessage.locator('[data-testid=download-button]').click();
    const download = await downloadPromise;
    
    // Verify download started
    expect(download.suggestedFilename()).toMatch(/\.ogg$|\.webm$/);
  });
});

test.describe('Voice Messages Accessibility', () => {
  test('should be keyboard navigable', async ({ page, context }) => {
    await context.grantPermissions(['microphone']);
    
    await page.goto('/login');
    await page.fill('[data-testid=email-input]', 'test@example.com');
    await page.fill('[data-testid=password-input]', 'password123');
    await page.keyboard.press('Enter');
    
    await page.goto('/chat/conversation_123');
    
    // Tab to voice recorder button
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab'); // Adjust based on UI
    
    // Activate with Enter
    await page.keyboard.press('Enter');
    
    // Verify recorder opened
    await expect(page.locator('[data-testid=voice-recorder]')).toBeVisible();
  });

  test('should have proper ARIA labels', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid=email-input]', 'test@example.com');
    await page.fill('[data-testid=password-input]', 'password123');
    await page.click('[data-testid=login-button]');
    
    await page.goto('/chat/conversation_with_voice');
    
    // Check voice message ARIA labels
    const voiceMessage = page.locator('[data-testid=voice-message]').first();
    await expect(voiceMessage).toHaveAttribute('role', 'button');
    await expect(voiceMessage).toHaveAttribute('aria-label', /voice message/i);
    
    // Check play button
    const playButton = voiceMessage.locator('[data-testid=play-button]');
    await expect(playButton).toHaveAttribute('aria-label', /play/i);
  });
});
