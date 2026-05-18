import { describe, it, expect, vi, beforeEach } from "vitest";
import { isRedirect } from "@tanstack/react-router";

vi.mock("@/lib/profile.functions", () => ({
  checkAdmin: vi.fn(),
}));

import { checkAdmin } from "@/lib/profile.functions";
import { Route as AdminLayoutRoute } from "@/routes/_authenticated/_admin";

const mockedCheckAdmin = checkAdmin as unknown as ReturnType<typeof vi.fn>;

describe("/admin route guard (beforeLoad)", () => {
  beforeEach(() => {
    mockedCheckAdmin.mockReset();
  });

  async function runBeforeLoad() {
    const beforeLoad = AdminLayoutRoute.options.beforeLoad as (args: unknown) => Promise<unknown>;
    return beforeLoad({} as never);
  }

  it("allows access when user IS admin (no redirect thrown)", async () => {
    mockedCheckAdmin.mockResolvedValueOnce({ isAdmin: true });
    await expect(runBeforeLoad()).resolves.not.toThrow();
  });

  it("redirects to / when user is NOT admin", async () => {
    mockedCheckAdmin.mockResolvedValueOnce({ isAdmin: false });
    let thrown: unknown;
    try {
      await runBeforeLoad();
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeDefined();
    expect(isRedirect(thrown)).toBe(true);
    expect((thrown as Response & { options: { to: string } }).options.to).toBe("/");
  });

  it("redirects to / when checkAdmin throws (e.g. unauthenticated)", async () => {
    mockedCheckAdmin.mockRejectedValueOnce(new Error("Unauthorized"));
    let thrown: unknown;
    try {
      await runBeforeLoad();
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeDefined();
    expect(isRedirect(thrown)).toBe(true);
    expect((thrown as Response & { options: { to: string } }).options.to).toBe("/");
  });

  it("redirects on subsequent visits too (simulates refresh)", async () => {
    mockedCheckAdmin.mockResolvedValue({ isAdmin: false });

    for (let i = 0; i < 3; i++) {
      let thrown: unknown;
      try {
        await runBeforeLoad();
      } catch (e) {
        thrown = e;
      }
      expect(isRedirect(thrown)).toBe(true);
      expect((thrown as Response & { options: { to: string } }).options.to).toBe("/");
    }
  });
});