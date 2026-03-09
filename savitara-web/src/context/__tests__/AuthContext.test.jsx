import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from '../../context/AuthContext';

// Mock react-router-dom navigation
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: '/', search: '', state: null }),
  };
});

// Mock @react-oauth/google
vi.mock('@react-oauth/google', () => ({
  useGoogleLogin: vi.fn(() => vi.fn()),
}));

// Mock firebase
vi.mock('../../services/firebase', () => ({
  firebaseSignOut: vi.fn().mockResolvedValue(undefined),
}));

// Mock react-toastify
vi.mock('react-toastify', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// Mock api
vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn().mockRejectedValue({ response: { status: 401 } }),
    post: vi.fn(),
    interceptors: {
      request: { use: vi.fn(), eject: vi.fn() },
      response: { use: vi.fn(), eject: vi.fn() },
    },
  },
}));

// Minimal component to expose auth context values
const AuthConsumer = () => {
  const { user, loading } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="user">{user ? user.email : 'null'}</span>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    // jsdom's localStorage may not implement clear; use vi's reset instead
    try { localStorage.clear(); } catch (_) { /* ignore */ }
    vi.clearAllMocks();
  });

  it('returns empty context outside provider (no user or loading)', () => {
    // AuthContext uses createContext({}) so outside provider it returns {}
    // useAuth's guard: `if (!context)` won't fire since {} is truthy.
    // Verify the consumer renders without crashing and shows defaults.
    const { getByTestId } = render(
      <MemoryRouter>
        <AuthConsumer />
      </MemoryRouter>
    );
    expect(getByTestId('user').textContent).toBe('null');
  });

  it('initializes with loading=true then resolves to unauthenticated state', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <AuthProvider>
            <AuthConsumer />
          </AuthProvider>
        </MemoryRouter>
      );
    });
    // After auth init is complete, loading should be false
    expect(screen.getByTestId('loading').textContent).toBe('false');
    expect(screen.getByTestId('user').textContent).toBe('null');
  });
});
