import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";

// Mock auth context
const useAuthMock = vi.fn();
vi.mock("@/lib/auth-context", () => ({
  useAuth: () => useAuthMock(),
}));

// Mock checkAdmin server fn
const checkAdminMock = vi.fn();
vi.mock("@/lib/profile.functions", () => ({
  checkAdmin: (...args: unknown[]) => checkAdminMock(...args),
}));

// useServerFn just returns the same function in tests
vi.mock("@tanstack/react-start", () => ({
  useServerFn: (fn: unknown) => fn,
}));

// Stub router primitives used by AppSidebar
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...rest }: React.PropsWithChildren<Record<string, unknown>>) =>
    React.createElement("a", rest as React.AnchorHTMLAttributes<HTMLAnchorElement>, children),
  useRouterState: () => "/",
}));

// Stub sidebar UI primitives to render plain elements (avoid SidebarProvider setup)
vi.mock("@/components/ui/sidebar", () => {
  const Passthrough = (tag: string) =>
    ({ children, asChild: _asChild, isActive: _isActive, tooltip: _tooltip, ...rest }: React.PropsWithChildren<Record<string, unknown>>) =>
      React.createElement(tag, rest as Record<string, unknown>, children);
  return {
    Sidebar: Passthrough("aside"),
    SidebarContent: Passthrough("div"),
    SidebarGroup: Passthrough("div"),
    SidebarGroupContent: Passthrough("div"),
    SidebarGroupLabel: Passthrough("div"),
    SidebarMenu: Passthrough("ul"),
    SidebarMenuButton: Passthrough("div"),
    SidebarMenuItem: Passthrough("li"),
    SidebarTrigger: Passthrough("button"),
    useSidebar: () => ({ state: "expanded" }),
  };
});

vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: ({ children, ...rest }: React.PropsWithChildren<Record<string, unknown>>) =>
    React.createElement("div", { "data-skeleton": true, ...rest }, children),
}));

import { AppSidebar } from "@/components/app/AppSidebar";

describe("AppSidebar — Admin menu visibility", () => {
  beforeEach(() => {
    useAuthMock.mockReset();
    checkAdminMock.mockReset();
    cleanup();
  });

  it("does NOT show Admin menu when user is not signed in", async () => {
    useAuthMock.mockReturnValue({ user: null });
    render(<AppSidebar />);
    // Wait a tick so useEffect runs
    await waitFor(() => {
      expect(screen.getByText("Feed")).toBeTruthy();
    });
    expect(screen.queryByText("Admin")).toBeNull();
    expect(checkAdminMock).not.toHaveBeenCalled();
  });

  it("does NOT show Admin menu for a regular signed-in user", async () => {
    useAuthMock.mockReturnValue({ user: { id: "user-1" } });
    checkAdminMock.mockResolvedValue({ isAdmin: false });
    render(<AppSidebar />);
    await waitFor(() => {
      expect(checkAdminMock).toHaveBeenCalled();
    });
    expect(screen.queryByText("Admin")).toBeNull();
    expect(screen.queryByTestId("admin-dashboard-menu")).toBeNull();
    expect(screen.queryByText("Admin Dashboard")).toBeNull();
  });

  it("DOES show Admin menu for an admin user", async () => {
    useAuthMock.mockReturnValue({ user: { id: "admin-1" } });
    checkAdminMock.mockResolvedValue({ isAdmin: true });
    render(<AppSidebar />);
    await waitFor(() => {
      expect(screen.getByText("Admin")).toBeTruthy();
    });
    expect(screen.getByTestId("admin-dashboard-menu")).toBeTruthy();
    expect(screen.getByText("Admin Dashboard")).toBeTruthy();
  });

  it("does NOT show Admin menu when checkAdmin throws (e.g. unauthorized)", async () => {
    useAuthMock.mockReturnValue({ user: { id: "user-2" } });
    checkAdminMock.mockRejectedValue(new Error("Unauthorized"));
    render(<AppSidebar />);
    await waitFor(() => {
      expect(checkAdminMock).toHaveBeenCalled();
    });
    expect(screen.queryByText("Admin")).toBeNull();
  });

  it("shows loading skeleton while checkAdmin is pending, then hides it after resolve", async () => {
    useAuthMock.mockReturnValue({ user: { id: "u-3" } });
    let resolveFn: (v: { isAdmin: boolean }) => void = () => {};
    checkAdminMock.mockReturnValue(
      new Promise<{ isAdmin: boolean }>((resolve) => {
        resolveFn = resolve;
      })
    );
    render(<AppSidebar />);
    // Loading visible immediately
    await waitFor(() => {
      expect(screen.getByTestId("admin-loading")).toBeTruthy();
    });
    expect(screen.queryByText("Admin")).toBeNull();

    resolveFn({ isAdmin: true });
    await waitFor(() => {
      expect(screen.getByText("Admin")).toBeTruthy();
    });
    expect(screen.queryByTestId("admin-loading")).toBeNull();
  });

  it("does NOT show loading skeleton when user is signed out", async () => {
    useAuthMock.mockReturnValue({ user: null });
    render(<AppSidebar />);
    await waitFor(() => {
      expect(screen.getByText("Feed")).toBeTruthy();
    });
    expect(screen.queryByTestId("admin-loading")).toBeNull();
  });

  it("hides skeleton and Admin menu when checkAdmin rejects, and keeps them hidden", async () => {
    useAuthMock.mockReturnValue({ user: { id: "u-err" } });
    let rejectFn: (e: unknown) => void = () => {};
    checkAdminMock.mockReturnValueOnce(
      new Promise<{ isAdmin: boolean }>((_resolve, reject) => {
        rejectFn = reject;
      })
    );
    render(<AppSidebar />);

    // Skeleton visible while pending
    await waitFor(() => {
      expect(screen.getByTestId("admin-loading")).toBeTruthy();
    });

    rejectFn(new Error("boom"));

    // After rejection: skeleton gone, Admin not shown
    await waitFor(() => {
      expect(screen.queryByTestId("admin-loading")).toBeNull();
    });
    expect(screen.queryByText("Admin")).toBeNull();

    // Stays hidden over time (no retry until user changes)
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByTestId("admin-loading")).toBeNull();
    expect(screen.queryByText("Admin")).toBeNull();
    expect(checkAdminMock).toHaveBeenCalledTimes(1);
  });

  it("re-checks admin on next login after a previous error", async () => {
    // First mount: signed out
    useAuthMock.mockReturnValue({ user: null });
    const { rerender } = render(<AppSidebar />);
    expect(checkAdminMock).not.toHaveBeenCalled();

    // Login as admin → effect re-runs because user changed
    checkAdminMock.mockResolvedValueOnce({ isAdmin: true });
    useAuthMock.mockReturnValue({ user: { id: "new-login" } });
    rerender(<AppSidebar />);

    await waitFor(() => {
      expect(screen.getByText("Admin")).toBeTruthy();
    });
    expect(checkAdminMock).toHaveBeenCalledTimes(1);
  });

  it("shows a retry button on error, and re-checks (granting Admin) when clicked", async () => {
    useAuthMock.mockReturnValue({ user: { id: "u-retry" } });
    checkAdminMock
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({ isAdmin: true });

    render(<AppSidebar />);

    // After first call rejects → retry button visible, Admin hidden
    await waitFor(() => {
      expect(screen.getByTestId("admin-retry")).toBeTruthy();
    });
    expect(screen.queryByText("Admin")).toBeNull();

    fireEvent.click(screen.getByText("ลองตรวจสอบอีกครั้ง"));

    // After retry resolves → Admin shown, retry gone
    await waitFor(() => {
      expect(screen.getByText("Admin")).toBeTruthy();
    });
    expect(screen.queryByTestId("admin-retry")).toBeNull();
    expect(checkAdminMock).toHaveBeenCalledTimes(2);
  });

  it("retry button stays hidden on success", async () => {
    useAuthMock.mockReturnValue({ user: { id: "u-ok" } });
    checkAdminMock.mockResolvedValue({ isAdmin: false });
    render(<AppSidebar />);
    await waitFor(() => {
      expect(checkAdminMock).toHaveBeenCalled();
    });
    expect(screen.queryByTestId("admin-retry")).toBeNull();
  });

  it("disables retry button and shows checking state while re-running", async () => {
    useAuthMock.mockReturnValue({ user: { id: "u-busy" } });

    let resolveSecond: (v: { isAdmin: boolean }) => void = () => {};
    checkAdminMock
      .mockRejectedValueOnce(new Error("network"))
      .mockReturnValueOnce(
        new Promise<{ isAdmin: boolean }>((resolve) => {
          resolveSecond = resolve;
        })
      );

    render(<AppSidebar />);

    // First failure → retry visible, idle label, not busy
    await waitFor(() => {
      expect(screen.getByText("ลองตรวจสอบอีกครั้ง")).toBeTruthy();
    });
    const retryItem = screen.getByTestId("admin-retry");
    let btn = retryItem.querySelector("[aria-busy]") as HTMLElement | null;
    expect(btn?.getAttribute("aria-busy")).toBe("false");
    expect(btn?.hasAttribute("disabled")).toBe(false);

    // Click retry → pending state
    fireEvent.click(screen.getByText("ลองตรวจสอบอีกครั้ง"));

    await waitFor(() => {
      expect(screen.getByText("กำลังตรวจสอบ...")).toBeTruthy();
    });
    // Still inside the retry item (not replaced with skeleton)
    expect(screen.getByTestId("admin-retry")).toBeTruthy();
    expect(screen.queryByTestId("admin-loading")).toBeNull();
    btn = screen.getByTestId("admin-retry").querySelector("[aria-busy]") as HTMLElement;
    expect(btn.getAttribute("aria-busy")).toBe("true");
    expect(btn.hasAttribute("disabled")).toBe(true);

    // Only 2 calls so far (initial + first retry); button is disabled to prevent more
    expect(checkAdminMock).toHaveBeenCalledTimes(2);

    // Resolve → Admin shown, retry gone
    resolveSecond({ isAdmin: true });
    await waitFor(() => {
      expect(screen.getByText("Admin")).toBeTruthy();
    });
    expect(screen.queryByTestId("admin-retry")).toBeNull();
  });

  it("re-enables retry and keeps label after a second failure (no skeleton)", async () => {
    useAuthMock.mockReturnValue({ user: { id: "u-fail-again" } });

    let rejectSecond: (e: unknown) => void = () => {};
    checkAdminMock
      .mockRejectedValueOnce(new Error("first"))
      .mockReturnValueOnce(
        new Promise<{ isAdmin: boolean }>((_resolve, reject) => {
          rejectSecond = reject;
        })
      );

    render(<AppSidebar />);

    // First failure → retry visible
    await waitFor(() => {
      expect(screen.getByText("ลองตรวจสอบอีกครั้ง")).toBeTruthy();
    });

    // Click retry → pending
    fireEvent.click(screen.getByText("ลองตรวจสอบอีกครั้ง"));
    await waitFor(() => {
      expect(screen.getByText("กำลังตรวจสอบ...")).toBeTruthy();
    });

    // Second failure
    rejectSecond(new Error("second"));

    // Back to idle retry state: enabled, idle label, no skeleton, Admin hidden
    await waitFor(() => {
      expect(screen.getByText("ลองตรวจสอบอีกครั้ง")).toBeTruthy();
    });
    const btn = screen
      .getByTestId("admin-retry")
      .querySelector("[aria-busy]") as HTMLElement;
    expect(btn.getAttribute("aria-busy")).toBe("false");
    expect(btn.hasAttribute("disabled")).toBe(false);
    expect(screen.queryByTestId("admin-loading")).toBeNull();
    expect(screen.queryByText("Admin")).toBeNull();
    expect(screen.queryByText("กำลังตรวจสอบ...")).toBeNull();

    // And it remains clickable for another retry
    checkAdminMock.mockResolvedValueOnce({ isAdmin: true });
    fireEvent.click(screen.getByText("ลองตรวจสอบอีกครั้ง"));
    await waitFor(() => {
      expect(screen.getByText("Admin")).toBeTruthy();
    });
    expect(checkAdminMock).toHaveBeenCalledTimes(3);
  });
});