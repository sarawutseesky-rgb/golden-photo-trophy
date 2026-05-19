import { test, expect } from "@playwright/test";

// /login?redirect=<value> must only honor internal paths starting with a
// single "/". Anything else (absolute URLs, protocol-relative "//", schemes
// like javascript:, mailto:, etc.) must fall back to "/" after a successful
// sign-in — never navigate to an external origin.
test.describe("Login redirect param sanitization", () => {
  const malicious = [
    "https://evil.example.com",
    "http://evil.example.com/path",
    "//evil.example.com",
    "//evil.example.com/photo/abc",
    "javascript:alert(1)",
    "mailto:foo@bar.com",
    "data:text/html,<script>alert(1)</script>",
    "evil.example.com",
    "",
  ];

  for (const value of malicious) {
    test(`malicious redirect "${value}" falls back to "/" after sign-in`, async ({
      page,
      context,
    }) => {
      const email = process.env.E2E_OWNER_EMAIL;
      const password = process.env.E2E_OWNER_PASSWORD;
      test.skip(!email || !password, "Set E2E_OWNER_EMAIL / E2E_OWNER_PASSWORD to run this test");

      const pageErrors: Error[] = [];
      page.on("pageerror", (e) => pageErrors.push(e));
      const failedResponses: { url: string; status: number }[] = [];
      page.on("response", (res) => {
        if (res.status() >= 500) failedResponses.push({ url: res.url(), status: res.status() });
      });

      await context.clearCookies();

      const origin = new URL(page.url() || "http://localhost").origin;

      // Open /login with the (non-internal) redirect param.
      await page.goto(`/login?redirect=${encodeURIComponent(value)}`);
      await expect(page.getByPlaceholder("Email")).toBeVisible({ timeout: 15_000 });

      const loginOrigin = new URL(page.url()).origin;

      await page.getByPlaceholder("Email").fill(email!);
      await page.getByPlaceholder("Password").fill(password!);
      await page.getByRole("button", { name: /sign in/i }).click();

      // Must land at pathname "/" on the SAME origin (not the malicious one).
      await expect
        .poll(() => new URL(page.url()).pathname, { timeout: 15_000 })
        .toBe("/");
      expect(new URL(page.url()).origin).toBe(loginOrigin);
      expect(new URL(page.url()).hostname).not.toContain("evil.example.com");

      await expect(page.getByText(/เกิดข้อผิดพลาด|invalid_type|nonoptional/i)).toHaveCount(0);
      expect(
        failedResponses,
        `Server returned 5xx: ${failedResponses.map((r) => `${r.status} ${r.url}`).join("\n")}`,
      ).toEqual([]);
      expect(
        pageErrors,
        `Uncaught page errors: ${pageErrors.map((e) => e.message).join("\n")}`,
      ).toEqual([]);

      // Silence "unused" lint for origin variable retained for clarity.
      void origin;
    });
  }
});
