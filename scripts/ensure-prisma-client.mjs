import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { stopWorkspaceDevProcesses } from "./utils/dev-processes.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = dirname(scriptDir);
const prismaSchemaPath = join(rootDir, "apps", "api", "prisma", "schema.prisma");
const prismaClientDir = join(rootDir, "node_modules", ".prisma", "client");
const forceGenerate = process.argv.includes("--force");

function run(command, args, options = {}) {
  const { captureOutput = false, forwardOutput = false, ...spawnOptions } = options;

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      stdio: captureOutput ? ["inherit", "pipe", "pipe"] : "inherit",
      shell: false,
      ...spawnOptions
    });

    let stdout = "";
    let stderr = "";

    if (captureOutput) {
      child.stdout.on("data", (chunk) => {
        const value = String(chunk);
        stdout += value;
        if (forwardOutput) {
          process.stdout.write(value);
        }
      });

      child.stderr.on("data", (chunk) => {
        const value = String(chunk);
        stderr += value;
        if (forwardOutput) {
          process.stderr.write(value);
        }
      });
    }

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      const capturedMessage = `${stderr}\n${stdout}`.trim();
      reject(new Error(capturedMessage || `${command} ${args.join(" ")} exited with code ${code ?? "unknown"}`));
    });
  });
}

function runShell(commandLine, options = {}) {
  if (process.platform === "win32") {
    return run("cmd.exe", ["/d", "/s", "/c", commandLine], options);
  }

  return run("sh", ["-lc", commandLine], options);
}

function listPrismaTempFiles() {
  if (!existsSync(prismaClientDir)) {
    return [];
  }

  return readdirSync(prismaClientDir).filter((fileName) => fileName.includes(".tmp"));
}

function cleanupPrismaTempFiles() {
  for (const fileName of listPrismaTempFiles()) {
    const filePath = join(prismaClientDir, fileName);

    try {
      rmSync(filePath, { force: true });
      console.log(`Removendo sobra temporaria do Prisma: ${fileName}`);
    } catch (error) {
      console.log(`Nao foi possivel remover ${fileName}: ${error.message}`);
    }
  }
}

function hasGeneratedPrismaClient() {
  if (!existsSync(prismaClientDir)) {
    return false;
  }

  const requiredFiles = [
    join(prismaClientDir, "client.js"),
    join(prismaClientDir, "schema.prisma")
  ];

  if (!requiredFiles.every((filePath) => existsSync(filePath))) {
    return false;
  }

  return readdirSync(prismaClientDir).some((fileName) => fileName.startsWith("query_engine"));
}

function shouldGeneratePrismaClient() {
  if (forceGenerate || !hasGeneratedPrismaClient()) {
    return true;
  }

  const generatedSchemaPath = join(prismaClientDir, "schema.prisma");
  return statSync(prismaSchemaPath).mtimeMs > statSync(generatedSchemaPath).mtimeMs;
}

function isRecoverablePrismaEngineError(error) {
  if (process.platform !== "win32") {
    return false;
  }

  return (
    error instanceof Error &&
    error.message.includes("EPERM: operation not permitted, rename") &&
    error.message.includes("query_engine-windows.dll.node")
  );
}

async function generatePrismaClient() {
  try {
    await runShell("npm run --workspace api prisma:generate:raw", { captureOutput: true });
    return;
  } catch (error) {
    if (!isRecoverablePrismaEngineError(error)) {
      throw error;
    }

    console.log(
      "Detectei a engine do Prisma travada por um processo antigo do workspace. Vou encerrar esses processos e tentar novamente..."
    );

    const stoppedProcesses = await stopWorkspaceDevProcesses(rootDir);

    if (stoppedProcesses.length === 0) {
      throw error;
    }

    cleanupPrismaTempFiles();
    await runShell("npm run --workspace api prisma:generate:raw", { captureOutput: true });
    console.log("Prisma Client gerado com sucesso apos encerrar processos antigos do workspace.");
  }
}

async function main() {
  cleanupPrismaTempFiles();

  if (!shouldGeneratePrismaClient()) {
    console.log("Prisma Client pronto. Pulando nova geracao.");
    return;
  }

  console.log("Prisma Client ausente ou desatualizado. Gerando novamente...");
  await generatePrismaClient();
}

main().catch((error) => {
  console.error("\nFalha ao garantir o Prisma Client:", error.message);
  process.exit(1);
});
