import { existsSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { ensureRequiredPortsAvailable } from "./utils/dev-processes.mjs";

const rootDir = process.cwd();

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      stdio: "inherit",
      shell: false,
      ...options
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} exited with code ${code ?? "unknown"}`));
    });
  });
}

function runShell(commandLine, options = {}) {
  if (process.platform === "win32") {
    return run("cmd.exe", ["/d", "/s", "/c", commandLine], options);
  }

  return run("sh", ["-lc", commandLine], options);
}

function hasInstalledDependencies() {
  const sentinels = [
    join(rootDir, "node_modules"),
    join(rootDir, "node_modules", "next", "package.json"),
    join(rootDir, "node_modules", "@prisma", "client", "package.json"),
    join(rootDir, "node_modules", "env-cmd", "package.json")
  ];

  return sentinels.every((path) => existsSync(path));
}

async function main() {
  await ensureRequiredPortsAvailable(rootDir, [
    { port: 3000, label: "frontend na porta 3000" },
    { port: 3001, label: "backend na porta 3001" }
  ]);

  if (!hasInstalledDependencies()) {
    console.log("Dependencias nao encontradas. Rodando npm install...");
    await runShell("npm install");
  } else {
    console.log("Dependencias ja instaladas. Pulando npm install.");
    await runShell("node scripts/ensure-prisma-client.mjs");
  }

  console.log("Subindo frontend, backend e dependencias de desenvolvimento...");
  await runShell("npm run dev:full");
}

main().catch((error) => {
  console.error("\nFalha ao iniciar o ambiente:", error.message);
  process.exit(1);
});
