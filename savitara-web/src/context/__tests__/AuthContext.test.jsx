import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from '../../context/AuthContext';
import api from '../../services/api';

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
    if (typeof localStorage?.clear === 'function') {
      localStorage.clear();
    }
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

  it('preserves cached session when auth bootstrap is rate limited', async () => {
    localStorage.setItem('accessToken', 'access-token');
    localStorage.setItem('refreshToken', 'refresh-token');
    localStorage.setItem('user', JSON.stringify({ email: 'cached@example.com', name: 'Cached User' }));
    api.get.mockRejectedValueOnce({ response: { status: 429 }, message: 'Too Many Requests' });

    await act(async () => {
      render(
        <MemoryRouter>
          <AuthProvider>
            <AuthConsumer />
          </AuthProvider>
        </MemoryRouter>
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
      expect(screen.getByTestId('user').textContent).toBe('cached@example.com');
    });

    expect(localStorage.getItem('accessToken')).toBe('access-token');
    expect(localStorage.getItem('refreshToken')).toBe('refresh-token');
    expect(JSON.parse(localStorage.getItem('user'))).toMatchObject({ email: 'cached@example.com' });
  });

  it('clears cached session when auth bootstrap returns unauthorized', async () => {
    localStorage.setItem('accessToken', 'access-token');
    localStorage.setItem('refreshToken', 'refresh-token');
    localStorage.setItem('user', JSON.stringify({ email: 'cached@example.com', name: 'Cached User' }));
    api.get.mockRejectedValueOnce({ response: { status: 401 }, message: 'Unauthorized' });

    await act(async () => {
      render(
        <MemoryRouter>
          <AuthProvider>
            <AuthConsumer />
          </AuthProvider>
        </MemoryRouter>
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
      expect(screen.getByTestId('user').textContent).toBe('null');
    });

    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });
});
