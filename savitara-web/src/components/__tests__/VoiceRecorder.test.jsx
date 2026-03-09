import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import VoiceRecorder from '../VoiceRecorder';

// Mock the browser compatibility util
vi.mock('../../utils/browserCompat', () => ({
  checkMediaRecorderSupport: vi.fn(() => ({ supported: true, codec: 'audio/webm' })),
  getBrowserInfo: vi.fn(() => ({ name: 'Chrome', version: '120' })),
}));

// Mock the API
vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn().mockResolvedValue({ data: { data: { message: { id: 'msg1' } } } }),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

// MediaRecorder mock
const mockMediaRecorder = {
  start: vi.fn(),
  stop: vi.fn(),
  state: 'inactive',
  ondataavailable: null,
  onstop: null,
  onerror: null,
};

beforeAll(() => {
  globalThis.MediaRecorder = vi.fn().mockImplementation(() => ({ ...mockMediaRecorder }));
  globalThis.MediaRecorder.isTypeSupported = vi.fn(() => true);
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  globalThis.URL.revokeObjectURL = vi.fn();

  const mockStream = { getTracks: vi.fn(() => [{ stop: vi.fn() }]) };
  globalThis.navigator.mediaDevices = {
    getUserMedia: vi.fn().mockResolvedValue(mockStream),
  };

  // AudioContext / AnalyserNode stubs
  globalThis.AudioContext = vi.fn().mockImplementation(() => ({
    createMediaStreamSource: vi.fn().mockReturnValue({ connect: vi.fn() }),
    createAnalyser: vi.fn().mockReturnValue({
      connect: vi.fn(),
      frequencyBinCount: 128,
      getByteFrequencyData: vi.fn(),
    }),
    close: vi.fn(),
  }));
});

afterEach(() => {
  vi.clearAllMocks();
});

afterAll(() => {
  vi.restoreAllMocks();
});

describe('VoiceRecorder', () => {
  it('renders the mic button in idle state', () => {
    render(<VoiceRecorder conversationId="conv1" onSend={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('button', { name: /record voice message/i })).toBeInTheDocument();
  });

  it('transitions to recording state on mic click and shows stop button', async () => {
    render(<VoiceRecorder conversationId="conv1" onSend={vi.fn()} onCancel={vi.fn()} />);
    const micBtn = screen.getByRole('button', { name: /record voice message/i });
    fireEvent.click(micBtn);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /stop recording/i })).toBeInTheDocument()
    );
  });

  it('shows cancel recording button during recording', async () => {
    render(<VoiceRecorder conversationId="conv1" onSend={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /record voice message/i }));
    await waitFor(() => screen.getByRole('button', { name: /cancel recording/i }));
    expect(screen.getByRole('button', { name: /cancel recording/i })).toBeInTheDocument();
  });

  it('calls onCancel when cancel recording button is clicked', async () => {
    const onCancel = vi.fn();
    render(<VoiceRecorder conversationId="conv1" onSend={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: /record voice message/i }));
    await waitFor(() => screen.getByRole('button', { name: /cancel recording/i }));
    fireEvent.click(screen.getByRole('button', { name: /cancel recording/i }));
    expect(onCancel).toHaveBeenCalled();
  });
});
