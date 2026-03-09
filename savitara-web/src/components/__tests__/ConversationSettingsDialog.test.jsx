import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ConversationSettingsDialog from '../ConversationSettingsDialog';

// Mock api
vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn().mockResolvedValue({
      data: {
        data: {
          conversations: [
            {
              id: 'conv1',
              is_muted: false,
              muted_until: null,
              is_pinned: false,
              is_archived: false,
            },
          ],
        },
      },
    }),
    patch: vi.fn().mockResolvedValue({ data: {} }),
    post: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

const defaultProps = {
  open: true,
  onClose: vi.fn(),
  conversationId: 'conv1',
  otherUser: { name: 'Test Acharya', role: 'acharya' },
};

describe('ConversationSettingsDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the dialog with user name', async () => {
    render(<ConversationSettingsDialog {...defaultProps} />);
    await waitFor(() => expect(screen.getByText('Test Acharya')).toBeInTheDocument());
  });

  it('shows Mute button when not muted', async () => {
    render(<ConversationSettingsDialog {...defaultProps} />);
    await waitFor(() => expect(screen.getByRole('button', { name: /mute/i })).toBeInTheDocument());
  });

  it('opens mute duration menu when Mute button is clicked', async () => {
    render(<ConversationSettingsDialog {...defaultProps} />);
    await waitFor(() => screen.getByRole('button', { name: /^mute$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^mute$/i }));
    await waitFor(() => {
      expect(screen.getByText('1 hour')).toBeInTheDocument();
      expect(screen.getByText('8 hours')).toBeInTheDocument();
      expect(screen.getByText('1 day')).toBeInTheDocument();
      expect(screen.getByText('1 week')).toBeInTheDocument();
      expect(screen.getByText('Indefinitely')).toBeInTheDocument();
    });
  });

  it('calls patch with is_muted:true and muted_until on selecting 1 hour', async () => {
    const api = (await import('../../services/api')).default;
    render(<ConversationSettingsDialog {...defaultProps} />);
    await waitFor(() => screen.getByRole('button', { name: /^mute$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^mute$/i }));
    await waitFor(() => screen.getByText('1 hour'));
    await act(async () => {
      fireEvent.click(screen.getByText('1 hour'));
    });
    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith(
        '/chat/conversations/conv1/settings',
        expect.objectContaining({ is_muted: true, muted_until: expect.any(String) })
      )
    );
  });

  it('shows Pin and Archive switches', async () => {
    render(<ConversationSettingsDialog {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Pin Conversation')).toBeInTheDocument();
      expect(screen.getByText('Archive Conversation')).toBeInTheDocument();
    });
  });

  it('calls onClose when Close button is clicked', async () => {
    render(<ConversationSettingsDialog {...defaultProps} />);
    await waitFor(() => screen.getByText('Close'));
    fireEvent.click(screen.getByText('Close'));
    expect(defaultProps.onClose).toHaveBeenCalledWith(false);
  });
});
