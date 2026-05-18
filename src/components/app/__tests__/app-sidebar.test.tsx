import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, waitFor, cleanup } from "@testing-library/react";

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
  });

  it("DOES show Admin menu for an admin user", async () => {
    useAuthMock.mockReturnValue({ user: { id: "admin-1" } });
    checkAdminMock.mockResolvedValue({ isAdmin: true });
    render(<AppSidebar />);
    await waitFor(() => {
      expect(screen.getByText("Admin")).toBeTruthy();
    });
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
});