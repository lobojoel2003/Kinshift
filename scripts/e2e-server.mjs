// Starts the production (standalone) build with a fresh, throwaway database for
// end-to-end tests. Run `npm run build` first.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const standalone = path.join(root, ".next", "standalone");
const dataDir = path.join(root, "e2e", ".data");

if (!fs.existsSync(path.join(standalone, "server.js"))) {
  console.error("No production build found. Run `npm run build` first.");
  process.exit(1);
}
fs.rmSync(dataDir, { recursive: true, force: true });
fs.mkdirSync(dataDir, { recursive: true });
fs.cpSync(path.join(root, "public"), path.join(standalone, "public"), { recursive: true });
fs.cpSync(path.join(root, ".next", "static"), path.join(standalone, ".next", "static"), {
  recursive: true,
});

const child = spawn(process.execPath, ["server.js"], {
  cwd: standalone,
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV: "production",
    PORT: process.env.PORT ?? "3300",
    HOSTNAME: "127.0.0.1",
    DATA_DIR: dataDir,
    KINSHIFT_SECRET: "e2e-test-secret-e2e-test-secret-e2e-test-secret",
    KINSHIFT_DISABLE_PUSH: "1",
    KINSHIFT_REGISTRATION: "invite",
  },
});
const stop = () => child.kill("SIGTERM");
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
child.on("exit", (code) => process.exit(code ?? 0));
