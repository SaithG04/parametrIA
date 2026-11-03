import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { getAccessToken, loginSession, logoutSession, useSession } from "@/hooks/use-session";

describe("session storage", () => {
  afterEach(() => {
    logoutSession();
    window.localStorage.clear();
  });

  it("removes legacy persisted tokens and keeps the current token in memory", () => {
    window.localStorage.setItem("tutoria.session", JSON.stringify({
      user: { id: "old-user" },
      accessToken: "legacy-token",
    }));

    const { result } = renderHook(() => useSession());

    expect(result.current.user).toBeNull();
    expect(window.localStorage.getItem("tutoria.session")).toBeNull();

    loginSession({
      user: {
        id: "user-1",
        name: "Ana",
        email: "ana@example.com",
        role: "STUDENT",
        universityId: null,
        universityName: null,
      },
      accessToken: "in-memory-token",
      expiresIn: 900,
    });

    expect(getAccessToken()).toBe("in-memory-token");
    expect(window.localStorage.getItem("tutoria.session")).toBeNull();
    logoutSession();
    expect(getAccessToken()).toBeNull();
  });
});
