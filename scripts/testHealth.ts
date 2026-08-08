import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const healthChecks = [
  { name: "TypeScript validation", args: ["run", "lint"] },
  { name: "Production build", args: ["run", "build"] },
];

for (const check of healthChecks) {
  console.log(`\n[health] ${check.name}`);
  const isWindows = process.platform === "win32";
  const command = isWindows ? process.env.ComSpec || "cmd.exe" : "npm";
  const args = isWindows
    ? ["/d", "/s", "/c", `npm ${check.args.join(" ")}`]
    : check.args;
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });

  if (result.error) {
    console.error(`[health] ${check.name} could not start: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`[health] ${check.name} failed.`);
    process.exit(result.status ?? 1);
  }
}

const requiredPaths = [
  "index.html",
  "public/manifest.json",
  "public/sw.js",
  "src/main.tsx",
  "api/index.ts",
];

const removedAdminPaths = [
  "src/admin",
  "api/adminAuth.ts",
  "api/adminDeliveryAreas.ts",
];

const missingRequiredPaths = requiredPaths.filter((filePath) => !existsSync(filePath));
if (missingRequiredPaths.length > 0) {
  console.error(`[health] Missing required files: ${missingRequiredPaths.join(", ")}`);
  process.exit(1);
}

const lingeringAdminPaths = removedAdminPaths.filter((filePath) => existsSync(filePath));
if (lingeringAdminPaths.length > 0) {
  console.error(`[health] Removed admin paths reappeared: ${lingeringAdminPaths.join(", ")}`);
  process.exit(1);
}

console.log("\n[health] Project health checks passed.");
