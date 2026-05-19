import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// Verifies that the OWNER's milestone clock resets when their photo loses #1
// (an opposing photo overtakes it) and restarts from zero when it regains #1.
//
// Required env:
//   E2E_OWNER_EMAIL, E2E_OWNER_PASSWORD  — owner login
//   E2E_SUPABASE_URL                     — Supabase project URL
//   E2E_SUPABASE_SERVICE_ROLE_KEY        — service role key (test env only)
//
// Strategy: use the service-role admin client to manipulate two photos'
// aggregates (avg_score, vote_count) and call the public cron endpoint
// (/api/public/cron/rank) to drive the ranking logic. Then assert the UI's
// Milestone status text in the photo detail page reflects:
//   1. clock running for owner's photo (Held #1 for …),
//   2. clock reset after another photo overtakes it (Reach #1 …),
//   3. clock restarted near zero after owner's photo regains #1.
test.describe("Photo detail — owner milestone clock resets on rank loss and restarts on regain", () => {
  test("owner sees clock running → reset → restarted via cron-driven rank swaps", async ({ page, context, baseURL }) => {
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

    // ── Login owner & locate first owned photo ──
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

    // Confirm logged-in user owns this photo via the visible Edit button.
    await page.goto(href!);
    await expect(page.getByRole("button", { name: /แก้ไข/ })).toBeVisible({ timeout: 15_000 });

    // Read owner's user_id from this photo so we can find a non-owned photo for the rival.
    const { data: ownerPhoto } = await admin
      .from("photos")
      .select("id, user_id, avg_score, vote_count, milestone_stars, rank_one_since")
      .eq("id", ownerPhotoId)
      .maybeSingle();
    expect(ownerPhoto, "owner photo row not found").toBeTruthy();

    // Skip if this photo has already maxed out milestones — clock won't run.
    test.skip(
      (ownerPhoto!.milestone_stars ?? 0) >= 5,
      "Owner photo already has 5★ — no clock to test",
    );

    // Pick a rival photo owned by someone else, active, not the owner.
    const { data: rivalPhoto } = await admin
      .from("photos")
      .select("id, user_id, avg_score, vote_count, rank_one_since")
      .eq("status", "active")
      .neq("user_id", ownerPhoto!.user_id)
      .neq("id", ownerPhotoId)
      .limit(1)
      .maybeSingle();
    test.skip(!rivalPhoto, "No rival (non-owned) photo available in DB to compete for #1");

    // Snapshot original state so we can restore at the end.
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

    try {
      // ── Phase 1: force owner photo to be #1, run cron, expect clock running ──
      await admin.from("photos").update({ rank_one_since: null }).neq("id", "00000000-0000-0000-0000-000000000000");
      await admin
        .from("photos")
        .update({ avg_score: 5.0, vote_count: Math.max(10, original.owner.vote_count ?? 0) })
        .eq("id", ownerPhotoId);
      await admin
        .from("photos")
        .update({ avg_score: 3.0, vote_count: Math.max(10, original.rival.vote_count ?? 0) })
        .eq("id", rivalPhoto!.id);

      await callCron();
      await page.goto(href!);
      const phase1 = await readStatus();
      expect(phase1, "phase 1: clock should be running for owner photo").toMatch(
        /Held #1 for [\d.]+d · next ★ at \d+d/,
      );

      // ── Phase 2: rival overtakes; cron must reset owner's rank_one_since ──
      await admin.from("photos").update({ avg_score: 4.0 }).eq("id", ownerPhotoId);
      await admin.from("photos").update({ avg_score: 5.0 }).eq("id", rivalPhoto!.id);
      await callCron();

      // Verify DB cleared owner's clock.
      const { data: afterLoss } = await admin
        .from("photos")
        .select("rank_one_since")
        .eq("id", ownerPhotoId)
        .maybeSingle();
      expect(afterLoss?.rank_one_since, "owner rank_one_since should be NULL after losing #1").toBeNull();

      await page.goto(href!);
      const phase2 = await readStatus();
      expect(phase2, "phase 2: clock should be reset (not holding)").toMatch(
        /Reach #1 \(min 10 votes\) to start the clock toward \d+d for your next ★/,
      );

      // ── Phase 3: owner regains #1; cron must restart clock from ~0 ──
      await admin.from("photos").update({ avg_score: 5.0 }).eq("id", ownerPhotoId);
      await admin.from("photos").update({ avg_score: 3.0 }).eq("id", rivalPhoto!.id);
      const beforeRegain = Date.now();
      await callCron();

      const { data: afterRegain } = await admin
        .from("photos")
        .select("rank_one_since")
        .eq("id", ownerPhotoId)
        .maybeSingle();
      expect(afterRegain?.rank_one_since, "owner rank_one_since should be set again").not.toBeNull();
      const restartedAt = new Date(afterRegain!.rank_one_since as string).getTime();
      expect(restartedAt, "rank_one_since should reflect a fresh start, not the old one").toBeGreaterThanOrEqual(
        beforeRegain - 5_000,
      );

      await page.goto(href!);
      const phase3 = await readStatus();
      const m = phase3.match(/Held #1 for ([\d.]+)d/);
      expect(m, `phase 3: clock should be running again — got "${phase3}"`).not.toBeNull();
      const elapsedDays = parseFloat(m![1]);
      // Restarted from ~0; comfortably under a single day.
      expect(elapsedDays).toBeLessThan(1);
    } finally {
      // Restore original aggregates and rank_one_since for both photos.
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