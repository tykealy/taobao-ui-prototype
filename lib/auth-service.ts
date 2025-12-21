// Authentication Service
// Handles third-party bearer token exchange and token management

interface AuthResponse {
  success: boolean;
  data: {
    accessToken: string;
    refreshToken: string;
  };
  message: string;
}

/**
 * Authenticate with third-party bearer token and get access/refresh tokens
 * @param bearerToken - The third-party bearer token (e.g., "Bearer SVAPK_...")
 * @returns Promise with authentication response
 */
export async function authenticateWithBearerToken(apiKey: string, bearerToken: string): Promise<AuthResponse> {

  // Use Next.js API route to avoid CORS issues
  const response = await fetch('/api/auth', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      apiKey,
      bearerToken
    }),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.message || 'Authentication failed');
  }

  return data;
}

/**
 * Store tokens in localStorage
 * @param accessToken - JWT access token
 * @param refreshToken - JWT refresh token
 */
export function storeTokens(accessToken: string, refreshToken: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    
    // Remove old authToken key for migration
    localStorage.removeItem('authToken');
  }
}

/**
 * Retrieve access token from localStorage
 * @returns Access token or null if not found
 */
export function getAccessToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('accessToken');
  }
  return null;
}

/**
 * Retrieve refresh token from localStorage
 * @returns Refresh token or null if not found
 */
export function getRefreshToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('refreshToken');
  }
  return null;
}

/**
 * Clear all tokens from localStorage
 */
export function clearTokens(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('authToken'); // Legacy cleanup
  }
}

/**
 * Check if user is authenticated
 * @returns true if access token exists
 */
export function isAuthenticated(): boolean {
  return getAccessToken() !== null;
}
