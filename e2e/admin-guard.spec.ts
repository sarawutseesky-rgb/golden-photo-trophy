import { test, expect } from "@playwright/test";

test.describe("Admin route access control", () => {
  test("non-admin user navigating directly to /admin is redirected to /", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForURL("/");
    expect(page.url()).toBe("http://localhost:3000/");
  });

  test("non-admin user refreshing /admin is redirected to /", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForURL("/");
    await page.reload();
    await page.waitForURL("/");
    expect(page.url()).toBe("http://localhost:3000/");
  });
});
