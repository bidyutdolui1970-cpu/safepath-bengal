import { createServer } from "node:http";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { validateReport, ValidationError } from "./shared/validation.mjs";

const HOST = "127.0.0.1";
const PORT = Number(process.env.PORT || 3001);
const DATA_DIR = fileURLToPath(new URL("./data/", import.meta.url));
const DATA_FILE = join(DATA_DIR, "reports.local.json");
const ALLOWED_ORIGINS = new Set((process.env.ALLOWED_ORIGINS || "http://localhost:8000,http://localhost:8001")
  .split(",").map((origin) => origin.trim()).filter(Boolean));
const SAFE_PATH_MODERATOR_TOKEN = process.env.SAFE_PATH_MODERATOR_TOKEN || "";
const requestLog = new Map();
let writeQueue = Promise.resolve();

function jsonResponse(response, status, payload, origin) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    ...(origin && ALLOWED_ORIGINS.has(origin) ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {})
  };
  response.writeHead(status, headers);
  response.end(JSON.stringify(payload));
}

function checkRateLimit(request, response, origin) {
  const now = Date.now();
  const key = request.socket.remoteAddress || "local";
  const recent = (requestLog.get(key) || []).filter((timestamp) => now - timestamp < 60_000);
  if (recent.length >= 30) {
    jsonResponse(response, 429, { message: "Too many requests. Try again in a minute." }, origin);
    return false;
  }
  recent.push(now);
  requestLog.set(key, recent);
  return true;
}

async function readReports() {
  try {
    const parsed = JSON.parse(await readFile(DATA_FILE, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function writeReports(reports) {
  writeQueue = writeQueue.then(async () => {
    await mkdir(DATA_DIR, { recursive: true });
    const temporaryFile = `${DATA_FILE}.tmp`;
    await writeFile(temporaryFile, JSON.stringify(reports, null, 2), "utf8");
    await rename(temporaryFile, DATA_FILE);
  });
  await writeQueue;
}

async function readJsonBody(request) {
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > 300 * 1024) throw new ValidationError("Request body is too large.");
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new ValidationError("Request body must be valid JSON.");
  }
}

function tokenMatches(candidate) {
  if (!SAFE_PATH_MODERATOR_TOKEN || !candidate) return false;
  const expected = Buffer.from(SAFE_PATH_MODERATOR_TOKEN);
  const received = Buffer.from(candidate);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

function hasRecentDuplicate(reports, candidate) {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  return reports.some((report) => report.category === candidate.category
    && report.lat === candidate.lat && report.lng === candidate.lng
    && Date.parse(report.createdAt || report.reportedAt) >= cutoff);
}

const server = createServer(async (request, response) => {
  const origin = request.headers.origin;
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return jsonResponse(response, 403, { message: "Origin is not allowed." });
  }
  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Origin": origin || "http://localhost:8001",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "300",
      Vary: "Origin"
    });
    return response.end();
  }
  if (!checkRateLimit(request, response, origin)) return;

  const url = new URL(request.url, `http://${HOST}:${PORT}`);
  try {
    if (request.method === "GET" && url.pathname === "/health") {
      return jsonResponse(response, 200, { status: "ok", mode: "local-json" }, origin);
    }
    if (request.method === "GET" && url.pathname === "/reports") {
      const reports = await readReports();
      return jsonResponse(response, 200, {
        reports: reports.map(({ imageDataUrl, ...report }) => ({ ...report, hasImage: Boolean(imageDataUrl) }))
      }, origin);
    }
    const reportRoute = url.pathname.match(/^\/reports\/([0-9a-f-]{36})$/i);
    if (request.method === "GET" && reportRoute) {
      const report = (await readReports()).find((item) => item.id === reportRoute[1]);
      if (!report) return jsonResponse(response, 404, { message: "Report not found." }, origin);
      return jsonResponse(response, 200, { report }, origin);
    }
    if (request.method === "POST" && url.pathname === "/reports") {
      const input = await readJsonBody(request);
      const candidate = validateReport(input);
      const existing = await readReports();
      if (hasRecentDuplicate(existing, candidate)) {
        return jsonResponse(response, 409, { message: "A similar report already exists for this approximate location." }, origin);
      }
      const report = {
        id: randomUUID(), ...candidate, status: "unverified", createdAt: new Date().toISOString()
      };
      await writeReports([report, ...existing]);
      return jsonResponse(response, 201, { report }, origin);
    }
    const statusRoute = url.pathname.match(/^\/reports\/([0-9a-f-]{36})\/status$/i);
    if (request.method === "PATCH" && statusRoute) {
      const bearer = String(request.headers.authorization || "").replace(/^Bearer\s+/i, "");
      if (!tokenMatches(bearer)) return jsonResponse(response, 401, { message: "Moderator authorization is required." }, origin);
      const input = await readJsonBody(request);
      if (!["unverified", "verified", "closed"].includes(input.status)) {
        return jsonResponse(response, 400, { message: "Status must be unverified, verified, or closed." }, origin);
      }
      const existing = await readReports();
      const index = existing.findIndex((report) => report.id === statusRoute[1]);
      if (index < 0) return jsonResponse(response, 404, { message: "Report not found." }, origin);
      existing[index] = { ...existing[index], status: input.status, updatedAt: new Date().toISOString() };
      await writeReports(existing);
      return jsonResponse(response, 200, { report: existing[index] }, origin);
    }
    return jsonResponse(response, 404, { message: "Route not found." }, origin);
  } catch (error) {
    const status = error instanceof ValidationError ? 400 : 500;
    if (status === 500) console.error("Local API error:", error.message);
    return jsonResponse(response, status, { message: status === 400 ? error.message : "The local API could not complete this request." }, origin);
  }
});

server.listen(PORT, HOST, () => console.log(`SafePath local API listening at http://${HOST}:${PORT}`));
server.on("error", (error) => {
  console.error(`Could not start the local API: ${error.message}`);
  process.exitCode = 1;
});