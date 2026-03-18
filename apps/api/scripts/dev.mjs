import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const workspaceDir = dirname(scriptDir);
const rootDir = dirname(dirname(workspaceDir));
const entryFile = join(workspaceDir, "dist", "apps", "api", "src", "main.js");

let shuttingDown = false;
const childProcesses = new Set();

function spawnProcess(command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: workspaceDir,
    stdio: "inherit",
    shell: false,
    ...options
  });

  childProcesses.add(child);

  child.on("exit", () => {
    childProcesses.delete(child);
  });

  child.on("error", (error) => {
    console.error(`Falha ao iniciar ${command}:`, error.message);
    shutdown(1);
  });

  return child;
}

function shutdown(code = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  for (const child of childProcesses) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }

  setTimeout(() => process.exit(code), 300);
}

async function waitForEntryFile(timeoutMs = 120_000) {
  const startedAt = Date.now();

  while (!existsSync(entryFile)) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(`A compilacao nao gerou ${entryFile} a tempo.`);
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 250);
    });
  }
}

async function main() {
  const buildArgs =
    process.platform === "win32"
      ? ["/d", "/s", "/c", "npx nest build --watch"]
      : ["-lc", "npx nest build --watch"];

  const buildCommand = process.platform === "win32" ? "cmd.exe" : "sh";
  const buildProcess = spawnProcess(buildCommand, buildArgs, {
    cwd: workspaceDir
  });

  buildProcess.on("exit", (code) => {
    if (!shuttingDown && code !== 0) {
      console.error(`Compilacao da API terminou com codigo ${code ?? "desconhecido"}.`);
      shutdown(code ?? 1);
    }
  });

  await waitForEntryFile();

  const runtimeArgs = ["--watch", "--enable-source-maps", entryFile];
  const runtimeProcess = spawnProcess(process.execPath, runtimeArgs, {
    cwd: rootDir
  });

  runtimeProcess.on("exit", (code) => {
    if (!shuttingDown && code !== 0) {
      console.error(`Processo da API terminou com codigo ${code ?? "desconhecido"}.`);
      shutdown(code ?? 1);
    }
  });
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

main().catch((error) => {
  console.error(error.message);
  shutdown(1);
});
