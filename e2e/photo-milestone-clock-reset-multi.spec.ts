import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// Verifies that the OWNER's milestone clock correctly resets and restarts
// across MULTIPLE consecutive #1 swaps (owner loses #1, regains it, loses it
// again, regains it again, …). After every cron call we assert the DB value
// of `rank_one_since` matches the expected state for that phase, and the
// detail page UI reflects "Held #1 for …" vs "Reach #1 …".
test.describe("Photo detail — owner milestone clock survives multiple rank swaps", () => {
  test("clock resets and restarts correctly across repeated #1 swaps", async ({ page, context, baseURL }) => {
    const email = process.env.E2E_OWNER_EMAIL;
    const password = process.env.E2E_OWNER_PASSWORD;
    const supabaseUrl = process.env.E2E_SUPABASE_URL;
    const serviceKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;
    test.skip(
      !email || !password || !supabaseUrl || !serviceKey,
      "Set E2E_OWNER_EMAIL / E2E_OWNER_PASSWORD / E2E_SUPABASE_URL / E2E_SUPABASE_SERVICE_ROLE_KEY to run this test",
    );

    const pageErrors: Error[] = [];
    page.on("pageerror", (e) => pageErrors.push(e));

    const admin = createClient(supabaseUrl!, serviceKey!, { auth: { persistSession: false } });

    await context.clearCookies();

    // Login owner & locate first owned photo.
    await page.goto("/login");
    await page.getByPlaceholder("Email").fill(email!);
    await page.getByPlaceholder("Password").fill(password!);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 });

    await page.goto("/");
    const firstPhoto = page.locator('a[href^="/photo/"]').first();
    await expect(firstPhoto).toBeVisible({ timeout: 15_000 });
    const href = await firstPhoto.getAttribute("href");
    const ownerPhotoId = href!.split("/").pop()!;
    expect(ownerPhotoId).toMatch(/^[\w-]+$/);

    await page.goto(href!);
    await expect(page.getByRole("button", { name: /แก้ไข/ })).toBeVisible({ timeout: 15_000 });

    const { data: ownerPhoto } = await admin
      .from("photos")
      .select("id, user_id, avg_score, vote_count, milestone_stars, rank_one_since")
      .eq("id", ownerPhotoId)
      .maybeSingle();
    expect(ownerPhoto, "owner photo row not found").toBeTruthy();
    test.skip(
      (ownerPhoto!.milestone_stars ?? 0) >= 5,
      "Owner photo already has 5★ — no clock to test",
    );

    const { data: rivalPhoto } = await admin
      .from("photos")
      .select("id, user_id, avg_score, vote_count, rank_one_since")
      .eq("status", "active")
      .neq("user_id", ownerPhoto!.user_id)
      .neq("id", ownerPhotoId)
      .limit(1)
      .maybeSingle();
    test.skip(!rivalPhoto, "No rival (non-owned) photo available in DB to compete for #1");

    const original = {
      owner: { ...ownerPhoto! },
      rival: { ...rivalPhoto! },
    };

    const cronUrl = new URL("/api/public/cron/rank", baseURL ?? "http://localhost:3000").toString();
    const callCron = async () => {
      const res = await page.request.post(cronUrl);
      expect(res.ok(), `cron call failed: ${res.status()}`).toBeTruthy();
      return res.json();
    };

    const milestoneCard = page.locator("div.rounded-xl.border.border-border.bg-card").filter({
      has: page.locator("text=Milestone stars"),
    });
    const statusEl = milestoneCard.locator("div.mt-3.text-xs.text-muted-foreground");
    const readStatus = async () => {
      await expect(milestoneCard).toBeVisible({ timeout: 15_000 });
      await expect(statusEl).toBeVisible({ timeout: 15_000 });
      return ((await statusEl.textContent()) ?? "").trim();
    };

    const readSince = async (id: string) => {
      const { data } = await admin.from("photos").select("rank_one_since").eq("id", id).maybeSingle();
      return data?.rank_one_since as string | null | undefined;
    };

    const makeOwnerTop = async () => {
      await admin
        .from("photos")
        .update({ avg_score: 5.0, vote_count: Math.max(10, original.owner.vote_count ?? 0) })
        .eq("id", ownerPhotoId);
      await admin
        .from("photos")
        .update({ avg_score: 3.0, vote_count: Math.max(10, original.rival.vote_count ?? 0) })
        .eq("id", rivalPhoto!.id);
    };
    const makeRivalTop = async () => {
      await admin.from("photos").update({ avg_score: 3.0 }).eq("id", ownerPhotoId);
      await admin.from("photos").update({ avg_score: 5.0 }).eq("id", rivalPhoto!.id);
    };

    try {
      // Start clean: clear all clocks.
      await admin
        .from("photos")
        .update({ rank_one_since: null })
        .not("rank_one_since", "is", null);

      const heldRegex = /Held #1 for ([\d.]+)d · next ★ at \d+d/;
      const resetRegex = /Reach #1 \(min 10 votes\) to start the clock toward \d+d for your next ★/;

      const previousStarts: string[] = [];

      // Run 3 full cycles of: owner #1 -> rival overtakes -> owner regains.
      for (let cycle = 1; cycle <= 3; cycle++) {
        // Phase A: owner becomes #1.
        await makeOwnerTop();
        const beforeStart = Date.now();
        await callCron();

        const startedAt = await readSince(ownerPhotoId);
        expect(startedAt, `cycle ${cycle}: owner rank_one_since should be set after regaining #1`).toBeTruthy();
        const startedMs = new Date(startedAt as string).getTime();
        expect(
          startedMs,
          `cycle ${cycle}: rank_one_since must reflect a fresh start, not a previous one`,
        ).toBeGreaterThanOrEqual(beforeStart - 5_000);
        // Must differ from every previous start timestamp.
        for (const prev of previousStarts) {
          expect(startedAt, `cycle ${cycle}: rank_one_since must differ from a previous cycle's start`).not.toEqual(prev);
        }
        previousStarts.push(startedAt as string);

        // Rival's clock must remain null while owner holds #1.
        const rivalSinceA = await readSince(rivalPhoto!.id);
        expect(rivalSinceA, `cycle ${cycle}: rival rank_one_since must be NULL while owner is #1`).toBeNull();

        await page.goto(href!);
        const statusA = await readStatus();
        const mA = statusA.match(heldRegex);
        expect(mA, `cycle ${cycle}: UI should show clock running — got "${statusA}"`).not.toBeNull();
        expect(parseFloat(mA![1]), `cycle ${cycle}: elapsed days should be ~0 just after start`).toBeLessThan(1);

        // Phase B: rival overtakes, owner's clock must reset.
        await makeRivalTop();
        await callCron();

        const afterLoss = await readSince(ownerPhotoId);
        expect(afterLoss, `cycle ${cycle}: owner rank_one_since must be NULL after losing #1`).toBeNull();
        const rivalSinceB = await readSince(rivalPhoto!.id);
        expect(rivalSinceB, `cycle ${cycle}: rival rank_one_since should be set after taking #1`).toBeTruthy();

        await page.goto(href!);
        const statusB = await readStatus();
        expect(statusB, `cycle ${cycle}: UI should show reset status — got "${statusB}"`).toMatch(resetRegex);
      }

      // All recorded owner starts must be unique (the clock truly restarted each cycle).
      expect(new Set(previousStarts).size).toBe(previousStarts.length);
    } finally {
      await admin
        .from("photos")
        .update({
          avg_score: original.owner.avg_score,
          vote_count: original.owner.vote_count,
          rank_one_since: original.owner.rank_one_since,
        })
        .eq("id", ownerPhotoId);
      await admin
        .from("photos")
        .update({
          avg_score: original.rival.avg_score,
          vote_count: original.rival.vote_count,
          rank_one_since: original.rival.rank_one_since,
        })
        .eq("id", rivalPhoto!.id);
    }

    expect(pageErrors, `Uncaught page errors: ${pageErrors.map((e) => e.message).join("\n")}`).toEqual([]);
  });
});