import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import EmojiPickerButton from '../EmojiPickerButton';

describe('EmojiPickerButton', () => {
  it('renders the add-reaction button', () => {
    render(<EmojiPickerButton onSelect={vi.fn()} />);
    expect(screen.getByRole('button', { name: /add reaction/i })).toBeInTheDocument();
  });

  it('opens the emoji picker on click', async () => {
    render(<EmojiPickerButton onSelect={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /add reaction/i }));
    // Category headings should appear
    await waitFor(() => expect(screen.getByText('Smileys')).toBeInTheDocument());
    expect(screen.getByText('Gestures')).toBeInTheDocument();
  });

  it('calls onSelect with the clicked emoji and closes picker', async () => {
    const onSelect = vi.fn();
    render(<EmojiPickerButton onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: /add reaction/i }));
    // Wait for the Gestures category to appear (contains 👍)
    await waitFor(() => screen.getByText('Gestures'), { timeout: 3000 });
    // Find the 👍 button by its text content (faster than role query across 200+ buttons)
    const thumbsUp = screen.getByText('👍');
    fireEvent.click(thumbsUp.closest('button'));
    expect(onSelect).toHaveBeenCalledWith('👍');
    // Popover should close — category text gone
    await waitFor(() => expect(screen.queryByText('Smileys')).not.toBeInTheDocument());
  }, 10000);

  it('does not open when disabled', () => {
    render(<EmojiPickerButton onSelect={vi.fn()} disabled />);
    const btn = screen.getByRole('button', { name: /add reaction/i });
    expect(btn).toBeDisabled();
  });
});
