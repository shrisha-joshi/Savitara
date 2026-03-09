import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MessageReactions from '../MessageReactions';

const mockReactions = [
  { emoji: '👍', user_id: 'user1' },
  { emoji: '👍', user_id: 'user2' },
  { emoji: '❤️', user_id: 'user1' },
];

describe('MessageReactions', () => {
  let onReact, onUnreact;

  beforeEach(() => {
    onReact = vi.fn().mockResolvedValue(undefined);
    onUnreact = vi.fn().mockResolvedValue(undefined);
  });

  it('renders nothing when reactions is empty', () => {
    const { container } = render(
      <MessageReactions reactions={[]} currentUserId="user1" onReact={onReact} onUnreact={onUnreact} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('groups reactions by emoji and shows count', () => {
    render(
      <MessageReactions
        reactions={mockReactions}
        currentUserId="user3"
        onReact={onReact}
        onUnreact={onUnreact}
      />
    );
    // 👍 appears twice — count should show 2
    expect(screen.getByText('2')).toBeInTheDocument();
    // ❤️ appears once — count should show 1
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('calls onReact when clicking a reaction that currentUser has not reacted to', async () => {
    render(
      <MessageReactions
        reactions={mockReactions}
        currentUserId="user3"
        onReact={onReact}
        onUnreact={onUnreact}
      />
    );
    // Click the ❤️ chip (user3 has not reacted)
    const heartChip = screen.getAllByRole('button').find((btn) =>
      btn.textContent.includes('❤️')
    );
    await act(async () => {
      fireEvent.click(heartChip);
    });
    await waitFor(() => expect(onReact).toHaveBeenCalledWith('❤️'));
    expect(onUnreact).not.toHaveBeenCalled();
  });

  it('calls onUnreact when clicking a reaction that currentUser already reacted to', async () => {
    render(
      <MessageReactions
        reactions={mockReactions}
        currentUserId="user1"
        onReact={onReact}
        onUnreact={onUnreact}
      />
    );
    // user1 reacted with 👍
    const thumbChip = screen.getAllByRole('button').find((btn) =>
      btn.textContent.includes('👍')
    );
    await act(async () => {
      fireEvent.click(thumbChip);
    });
    await waitFor(() => expect(onUnreact).toHaveBeenCalledWith('👍'));
    expect(onReact).not.toHaveBeenCalled();
  });

  it('disables all chips when disabled=true', () => {
    render(
      <MessageReactions
        reactions={mockReactions}
        currentUserId="user1"
        onReact={onReact}
        onUnreact={onUnreact}
        disabled
      />
    );
    // MUI Chip renders with aria-disabled rather than the HTML disabled attribute
    const buttons = screen.getAllByRole('button');
    buttons.forEach((btn) => expect(btn).toHaveAttribute('aria-disabled', 'true'));
  });
});
