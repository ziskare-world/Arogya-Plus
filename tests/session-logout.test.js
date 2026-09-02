/**
 * Unit & Integration Test Suite for Remember-Me & Logout Session Management
 */

describe("Remember-Me & Logout Session Management Logic", () => {
  const TOKEN_KEY = "smart_hospital_token";
  const USER_KEY = "smart_hospital_user";
  const SESSION_USER_KEY = "arogya_user";

  let mockLocalStorage = {};
  let mockSessionStorage = {};

  const fakeStorage = (store) => ({
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => {
      store[k] = String(v);
    },
    removeItem: (k) => {
      delete store[k];
    },
    clear: () => {
      Object.keys(store).forEach((k) => delete store[k]);
    }
  });

  let localStorageMock;
  let sessionStorageMock;

  beforeEach(() => {
    mockLocalStorage = {};
    mockSessionStorage = {};
    localStorageMock = fakeStorage(mockLocalStorage);
    sessionStorageMock = fakeStorage(mockSessionStorage);
  });

  const storeAuthSession = (tokenData, isRemember) => {
    // 1. Wipe prior stale session tokens from both storages
    localStorageMock.removeItem(TOKEN_KEY);
    localStorageMock.removeItem(USER_KEY);
    sessionStorageMock.removeItem(TOKEN_KEY);
    sessionStorageMock.removeItem(USER_KEY);
    sessionStorageMock.removeItem(SESSION_USER_KEY);

    // 2. Route to appropriate storage target based on Remember Me
    const storage = isRemember ? localStorageMock : sessionStorageMock;

    if (tokenData.token) {
      storage.setItem(TOKEN_KEY, tokenData.token);
    }
    if (tokenData.user) {
      storage.setItem(USER_KEY, JSON.stringify(tokenData.user));
      sessionStorageMock.setItem(
        SESSION_USER_KEY,
        JSON.stringify({
          name: tokenData.user.name,
          email: tokenData.user.email,
          role: tokenData.user.role
        })
      );
    }
  };

  const clearAuthState = () => {
    localStorageMock.removeItem(TOKEN_KEY);
    localStorageMock.removeItem(USER_KEY);
    localStorageMock.removeItem("smart_hospital_auth_notice");
    sessionStorageMock.removeItem(TOKEN_KEY);
    sessionStorageMock.removeItem(USER_KEY);
    sessionStorageMock.removeItem(SESSION_USER_KEY);
    sessionStorageMock.removeItem("smart_hospital_auth_notice");
    sessionStorageMock.clear();
  };

  const evaluateAutoRedirectOnLogin = (queryParams = "") => {
    const isExplicitLogout = queryParams.includes("logout=true");
    if (isExplicitLogout) {
      clearAuthState();
      return { redirect: false, target: null };
    }

    const existingToken =
      localStorageMock.getItem(TOKEN_KEY) || sessionStorageMock.getItem(TOKEN_KEY);
    const existingUserStr =
      localStorageMock.getItem(USER_KEY) || sessionStorageMock.getItem(USER_KEY);

    if (existingToken && existingUserStr) {
      try {
        const userObj = JSON.parse(existingUserStr);
        if (userObj && userObj.role) {
          const role = userObj.role.toLowerCase();
          const target = role.includes("admin")
            ? "/admin/dashboard"
            : role.includes("doctor")
            ? "/doctor/dashboard"
            : "/user/dashboard";
          return { redirect: true, target };
        }
      } catch (e) {}
    }

    return { redirect: false, target: null };
  };

  test("persists token in localStorage when Remember Me is enabled (isRemember: true)", () => {
    const testPayload = {
      token: "jwt-remember-token-xyz",
      user: { id: "123", name: "John Doe", email: "john@example.com", role: "patient" }
    };

    storeAuthSession(testPayload, true);

    expect(localStorageMock.getItem(TOKEN_KEY)).toBe("jwt-remember-token-xyz");
    expect(localStorageMock.getItem(USER_KEY)).toContain("John Doe");
    expect(sessionStorageMock.getItem(TOKEN_KEY)).toBeNull();
  });

  test("persists token in sessionStorage only when Remember Me is disabled (isRemember: false)", () => {
    const testPayload = {
      token: "jwt-session-token-abc",
      user: { id: "456", name: "Jane Doe", email: "jane@example.com", role: "doctor" }
    };

    storeAuthSession(testPayload, false);

    expect(sessionStorageMock.getItem(TOKEN_KEY)).toBe("jwt-session-token-abc");
    expect(sessionStorageMock.getItem(USER_KEY)).toContain("Jane Doe");
    expect(localStorageMock.getItem(TOKEN_KEY)).toBeNull();
  });

  test("completely purges credentials on logout even if previously saved via Remember Me", () => {
    // 1. User signs in with Remember Me
    storeAuthSession(
      {
        token: "persistent-jwt-token",
        user: { id: "789", name: "Super User", email: "admin@arogya.com", role: "admin" }
      },
      true
    );

    expect(localStorageMock.getItem(TOKEN_KEY)).toBe("persistent-jwt-token");

    // 2. User clicks Log Out
    clearAuthState();

    // 3. Verify ALL storage keys are clean
    expect(localStorageMock.getItem(TOKEN_KEY)).toBeNull();
    expect(localStorageMock.getItem(USER_KEY)).toBeNull();
    expect(sessionStorageMock.getItem(TOKEN_KEY)).toBeNull();
    expect(sessionStorageMock.getItem(USER_KEY)).toBeNull();
    expect(sessionStorageMock.getItem(SESSION_USER_KEY)).toBeNull();
  });

  test("does NOT auto-redirect to dashboard when arriving with ?logout=true", () => {
    // Leftover token in localStorage
    localStorageMock.setItem(TOKEN_KEY, "old-token");
    localStorageMock.setItem(
      USER_KEY,
      JSON.stringify({ name: "Old", email: "old@test.com", role: "patient" })
    );

    // Visiting login page with ?logout=true
    const result = evaluateAutoRedirectOnLogin("?logout=true");

    expect(result.redirect).toBe(false);
    expect(result.target).toBeNull();
    // And storage is cleanly emptied
    expect(localStorageMock.getItem(TOKEN_KEY)).toBeNull();
  });

  test("auto-redirects to dashboard when active session exists without logout parameter", () => {
    localStorageMock.setItem(TOKEN_KEY, "valid-token");
    localStorageMock.setItem(
      USER_KEY,
      JSON.stringify({ name: "User", email: "user@test.com", role: "patient" })
    );

    const result = evaluateAutoRedirectOnLogin("");

    expect(result.redirect).toBe(true);
    expect(result.target).toBe("/user/dashboard");
  });
});
