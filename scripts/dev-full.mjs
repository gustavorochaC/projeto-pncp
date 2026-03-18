import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { spawn } from "node:child_process";
import { ensureRequiredPortsAvailable } from "./utils/dev-processes.mjs";

const rootDir = process.cwd();
const envFile = join(rootDir, ".env");

function parseEnvFile() {
  if (!existsSync(envFile)) {
    return {};
  }

  const content = readFileSync(envFile, "utf8");
  const entries = content
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.trim().startsWith("#"))
    .map((line) => {
      const separatorIndex = line.indexOf("=");
      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim().replace(/^"(.*)"$/, "$1");
      return [key, value];
    });

  return Object.fromEntries(entries);
}

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

function checkCommand(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      stdio: "ignore",
      shell: false
    });

    child.on("error", () => resolve(false));
    child.on("exit", (code) => resolve(code === 0));
  });
}

function checkCommandInShell(commandLine) {
  return new Promise((resolve) => {
    const child =
      process.platform === "win32"
        ? spawn("cmd.exe", ["/d", "/s", "/c", commandLine], {
            cwd: rootDir,
            stdio: "ignore",
            shell: false
          })
        : spawn("sh", ["-lc", commandLine], {
            cwd: rootDir,
            stdio: "ignore",
            shell: false
          });

    child.on("error", () => resolve(false));
    child.on("exit", (code) => resolve(code === 0));
  });
}

async function waitForOllama(baseUrl) {
  const healthUrl = `${baseUrl.replace(/\/$/, "")}/api/tags`;

  for (let attempt = 1; attempt <= 30; attempt += 1) {
    try {
      const response = await fetch(healthUrl);
      if (response.ok) {
        return;
      }
    } catch {}

    console.log(`Aguardando Ollama ficar pronto (${attempt}/30)...`);
    await delay(2_000);
  }

  throw new Error("Ollama nao respondeu a tempo.");
}

async function fetchTags(baseUrl) {
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/tags`);
  if (!response.ok) {
    throw new Error(`Falha ao consultar modelos em ${baseUrl}`);
  }

  return response.json();
}

async function hasModel(baseUrl, model) {
  const data = await fetchTags(baseUrl);
  return Array.isArray(data.models) && data.models.some((item) => item.name === model);
}

async function ensureModel(model, mode) {
  if (mode === "local") {
    console.log(`Garantindo modelo ${model} no Ollama local...`);
    const ollamaCommand = process.platform === "win32" ? "ollama.exe" : "ollama";
    await run(ollamaCommand, ["pull", model]);
    return;
  }

  console.log(`Garantindo modelo ${model} no container do Ollama...`);
  await run("docker", ["compose", "exec", "-T", "ollama", "ollama", "pull", model]);
}

async function main() {
  await ensureRequiredPortsAvailable(rootDir, [
    { port: 3000, label: "frontend na porta 3000" },
    { port: 3001, label: "backend na porta 3001" }
  ]);

  const env = parseEnvFile();
  const generationModel = env.OLLAMA_GENERATION_MODEL || "qwen2.5:7b";
  const embeddingModel = env.OLLAMA_EMBEDDING_MODEL || "qwen3-embedding";
  const ollamaBaseUrl = env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
  const dockerAvailable =
    process.platform === "win32"
      ? await checkCommandInShell("docker version")
      : await checkCommand("docker", ["version"]);
  let ollamaMode = "docker";
  let localOllamaAvailable = false;

  try {
    await waitForOllama(ollamaBaseUrl);
    localOllamaAvailable = true;
  } catch {}

  if (localOllamaAvailable) {
    ollamaMode = "local";
    console.log("Ollama local detectado. Vou reutilizar a instancia local.");

    if (dockerAvailable) {
      try {
        console.log("Subindo apenas Redis no Docker...");
        await run("docker", ["compose", "up", "-d", "redis"]);
      } catch {
        console.log("Docker ainda nao esta pronto. Vou seguir sem Redis por enquanto.");
      }
    } else {
      console.log("Docker nao encontrado. Vou seguir sem Redis por enquanto.");
    }
  } else {
    if (!dockerAvailable) {
      throw new Error(
        "Nem Ollama local nem Docker estao disponiveis. Abra o Docker Desktop ou inicie o Ollama local antes de rodar o comando unico."
      );
    }

    console.log("Ollama local nao respondeu. Vou subir Redis e Ollama no Docker.");
    await run("docker", ["compose", "up", "-d", "redis", "ollama"]);

    console.log("Esperando Ollama responder...");
    await waitForOllama(ollamaBaseUrl);
  }

  if (!(await hasModel(ollamaBaseUrl, generationModel))) {
    await ensureModel(generationModel, ollamaMode);
  }

  if (!(await hasModel(ollamaBaseUrl, embeddingModel))) {
    await ensureModel(embeddingModel, ollamaMode);
  }

  console.log("Iniciando frontend e backend...");
  await runShell("npm run dev");
}

main().catch((error) => {
  console.error("\nFalha ao preparar o ambiente:", error.message);
  process.exit(1);
});
