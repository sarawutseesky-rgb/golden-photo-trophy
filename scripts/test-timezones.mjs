#!/usr/bin/env node
// Run the timezone-sensitive test suite under multiple TZ env values so we
// catch any created_at / now drift caused by the runner's local timezone.
// Add new zones here as needed.
import { spawnSync } from "node:child_process";

const ZONES = [
  "UTC",
  "Asia/Bangkok",       // +07, no DST
  "America/New_York",   // -05/-04, DST
  "Pacific/Kiritimati", // +14, extreme east
  "Pacific/Niue",       // -11, extreme west
];

const TARGET =
  process.argv[2] ?? "src/lib/__tests__/milestone-rules.timezone.test.ts";

let failed = 0;
for (const TZ of ZONES) {
  console.log(`\n=== TZ=${TZ} ===`);
  const r = spawnSync("bunx", ["vitest", "run", TARGET], {
    stdio: "inherit",
    env: { ...process.env, TZ },
  });
  if (r.status !== 0) {
    failed++;
    console.error(`FAILED in TZ=${TZ}`);
  }
}

if (failed > 0) {
  console.error(`\n${failed} timezone(s) failed.`);
  process.exit(1);
}
console.log(`\nAll ${ZONES.length} timezones passed.`);