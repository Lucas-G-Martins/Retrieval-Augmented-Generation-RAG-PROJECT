import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { RagApp } from "./ragApp.ts";

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = join(process.cwd(), "public");

const contentTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

const ragApp = new RagApp({
  debugLog: (...args) => console.log("[rag]", ...args),
});

function sendJson(
  response: import("node:http").ServerResponse,
  statusCode: number,
  payload: unknown,
) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
}

async function readRequestBody(request: import("node:http").IncomingMessage) {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString("utf-8");
}

async function serveStaticFile(
  pathname: string,
  response: import("node:http").ServerResponse,
) {
  const filePath = pathname === "/" ? "/index.html" : pathname;
  const normalizedPath = normalize(filePath).replace(/^(\.\.[/\\])+/, "");
  const absolutePath = join(PUBLIC_DIR, normalizedPath);

  try {
    const file = await readFile(absolutePath);
    response.writeHead(200, {
      "Content-Type":
        contentTypes[extname(absolutePath)] || "text/plain; charset=utf-8",
    });
    response.end(file);
  } catch {
    response.writeHead(404, {
      "Content-Type": "text/plain; charset=utf-8",
    });
    response.end("Arquivo nao encontrado.");
  }
}

try {
  await ragApp.initialize();

  const server = createServer(async (request, response) => {
    const url = new URL(request.url || "/", `http://${request.headers.host}`);

    if (request.method === "GET" && url.pathname === "/api/health") {
      return sendJson(response, 200, {
        ok: true,
        port: PORT,
        ...ragApp.getStatus(),
      });
    }

    if (request.method === "POST" && url.pathname === "/api/ask") {
      try {
        const rawBody = await readRequestBody(request);
        const { question } = JSON.parse(rawBody || "{}");

        if (!question || typeof question !== "string") {
          return sendJson(response, 400, {
            error: "Envie uma pergunta valida.",
          });
        }

        const result = await ragApp.answerQuestion(question.trim());
        return sendJson(response, result.error ? 422 : 200, result);
      } catch (error) {
        console.error(error);
        return sendJson(response, 500, {
          error: "Nao foi possivel processar a pergunta.",
        });
      }
    }

    return serveStaticFile(url.pathname, response);
  });

  server.listen(PORT, () => {
    console.log(`Servidor web rodando em http://localhost:${PORT}`);
  });

  const shutdown = async () => {
    server.close(async () => {
      await ragApp.close();
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
} catch (error) {
  console.error("Erro ao inicializar o servidor:", error);
  await ragApp.close();
  process.exit(1);
}
