import { spawn } from "node:child_process";
import { createServer } from "node:net";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";

const DEV_PROCESS_PATTERNS = [
  "turbo run dev --parallel",
  "next dev",
  "start-server.js",
  "scripts/dev-full.mjs",
  "scripts/dev.mjs",
  "nest build --watch",
  "apps\\api\\dist\\apps\\api\\src\\main.js",
  "apps/api/dist/apps/api/src/main.js"
];

function runCaptured(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      shell: false
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      reject(new Error(stderr.trim() || `${command} ${args.join(" ")} exited with code ${code ?? "unknown"}`));
    });
  });
}

function parseJsonArray(rawValue) {
  const trimmed = rawValue.trim();

  if (!trimmed) {
    return [];
  }

  const parsed = JSON.parse(trimmed);
  return Array.isArray(parsed) ? parsed : [parsed];
}

function matchesWorkspaceDevProcess(rootDir, commandLine) {
  if (!commandLine || !commandLine.includes(rootDir)) {
    return false;
  }

  return DEV_PROCESS_PATTERNS.some((pattern) => commandLine.includes(pattern));
}

async function listWorkspaceDevProcessesWindows(rootDir) {
  const escapedRootDir = rootDir.replace(/'/g, "''");
  const script =
    `[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; ` +
    `Get-CimInstance Win32_Process | ` +
    `Where-Object { $_.CommandLine -and $_.CommandLine.Contains('${escapedRootDir}') } | ` +
    `Select-Object ProcessId,ParentProcessId,Name,CommandLine | ConvertTo-Json -Compress`;
  const { stdout } = await runCaptured("powershell.exe", ["-NoProfile", "-Command", script]);

  return parseJsonArray(stdout).map((item) => ({
    pid: Number(item.ProcessId),
    parentPid: Number(item.ParentProcessId),
    name: String(item.Name ?? ""),
    commandLine: String(item.CommandLine ?? "")
  }));
}

async function listWorkspaceDevProcessesPosix(rootDir) {
  const { stdout } = await runCaptured("ps", ["-ax", "-o", "pid=", "-o", "command="]);

  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(\d+)\s+(.*)$/);

      if (!match) {
        return null;
      }

      return {
        pid: Number(match[1]),
        parentPid: null,
        name: "",
        commandLine: match[2]
      };
    })
    .filter(Boolean)
    .filter((item) => item.commandLine.includes(rootDir));
}

async function listWorkspaceDevProcesses(rootDir) {
  const processes =
    process.platform === "win32"
      ? await listWorkspaceDevProcessesWindows(rootDir)
      : await listWorkspaceDevProcessesPosix(rootDir);

  return processes.filter(
    (item) => item.pid !== process.pid && matchesWorkspaceDevProcess(rootDir, item.commandLine)
  );
}

async function stopProcessTree(processInfo) {
  if (process.platform === "win32") {
    try {
      await runCaptured("taskkill.exe", ["/PID", String(processInfo.pid), "/T", "/F"]);
    } catch {}

    return;
  }

  try {
    process.kill(processInfo.pid, "SIGTERM");
  } catch {}
}

async function waitForPortsToBeFree(ports, attempts = 20) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const busyPorts = await getBusyPorts(ports);

    if (busyPorts.length === 0) {
      return true;
    }

    await delay(500);
  }

  return false;
}

export function isPortBusy(port) {
  return new Promise((resolve, reject) => {
    const server = createServer();

    server.once("error", (error) => {
      if (error.code === "EADDRINUSE") {
        resolve(true);
        return;
      }

      reject(error);
    });

    server.once("listening", () => {
      server.close(() => resolve(false));
    });

    server.listen(port);
  });
}

export async function getBusyPorts(ports) {
  const checks = await Promise.all(
    ports.map(async ({ port, label }) => ({
      port,
      label,
      busy: await isPortBusy(port)
    }))
  );

  return checks.filter((item) => item.busy);
}

export async function ensureRequiredPortsAvailable(rootDir, ports) {
  const busyPorts = await getBusyPorts(ports);

  if (busyPorts.length === 0) {
    return;
  }

  const workspaceProcesses = await listWorkspaceDevProcesses(rootDir);

  if (workspaceProcesses.length === 0) {
    throw new Error(
      `Ja existe uma instancia usando ${busyPorts.map((item) => item.label).join(" e ")}. Feche os processos atuais antes de rodar o ambiente novamente.`
    );
  }

  console.log("Detectei uma instancia anterior do projeto. Vou reiniciar os processos de desenvolvimento...");

  const uniqueProcesses = [...new Map(workspaceProcesses.map((item) => [item.pid, item])).values()];

  for (const processInfo of uniqueProcesses) {
    await stopProcessTree(processInfo);
  }

  const portsReleased = await waitForPortsToBeFree(ports);

  if (portsReleased) {
    return;
  }

  const remainingBusyPorts = await getBusyPorts(ports);

  throw new Error(
    `Nao consegui liberar ${remainingBusyPorts.map((item) => item.label).join(" e ")} automaticamente. Feche os processos atuais antes de rodar o ambiente novamente.`
  );
}
