import { randomUUID, timingSafeEqual } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { validateReport, ValidationError } from "../shared/validation.mjs";

const database = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true }
});
const tableName = process.env.REPORTS_TABLE;
const allowedOrigins = new Set((process.env.ALLOWED_ORIGINS || "").split(",").map((value) => value.trim()).filter(Boolean));

function response(statusCode, payload, origin) {
  const allowedOrigin = origin && (allowedOrigins.has(origin) || allowedOrigins.has("*"))
    ? (allowedOrigins.has("*") ? "*" : origin) : undefined;
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...(allowedOrigin ? { "Access-Control-Allow-Origin": allowedOrigin, Vary: "Origin" } : {})
    },
    body: payload === null ? "" : JSON.stringify(payload)
  };
}
  return publicReport(report, true);
}

async function getReport(reportId, origin) {
  const result = await database.send(new GetCommand({ TableName: tableName, Key: { reportId } }));
  if (!result.Item) return response(404, { message: "Report not found." }, origin);
  return response(200, { report: publicReport(result.Item, true) }, origin);
function decodeBody(event) {
  if (!event.body) return {};
  const body = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
  if (Buffer.byteLength(body, "utf8") > 300 * 1024) throw new ValidationError("Request body is too large.");
  try {
    return JSON.parse(body);
  } catch {
    throw new ValidationError("Request body must be valid JSON.");
  }
}

function publicReport(item, includeImage = false) {
  const { duplicateKey, imageDataUrl, ...report } = item;
  return { ...report, hasImage: Boolean(imageDataUrl), ...(includeImage && imageDataUrl ? { imageDataUrl } : {}) };
}

function moderatorAuthorized(event) {
  const expectedToken = process.env.MODERATOR_TOKEN || "";
  const authorization = event.headers?.authorization || event.headers?.Authorization || "";
  const suppliedToken = authorization.replace(/^Bearer\s+/i, "");
  if (!expectedToken || !suppliedToken) return false;
  const expected = Buffer.from(expectedToken);
  const supplied = Buffer.from(suppliedToken);
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

async function listReports(event) {
  let cursor;
  if (event.queryStringParameters?.cursor) {
    try {
      cursor = JSON.parse(Buffer.from(event.queryStringParameters.cursor, "base64url").toString("utf8"));
    } catch {
      throw new ValidationError("Cursor is invalid.");
    }
  }
  const result = await database.send(new ScanCommand({
    TableName: tableName, Limit: 200, ...(cursor ? { ExclusiveStartKey: cursor } : {})
  }));
  const items = (result.Items || []).map(publicReport)
    .sort((left, right) => String(right.reportedAt).localeCompare(String(left.reportedAt)));
  const nextCursor = result.LastEvaluatedKey
    ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString("base64url") : null;
  return { reports: items, nextCursor };
}

async function createReport(event) {
  const candidate = validateReport(decodeBody(event));
  const now = new Date();
  const createdAt = now.toISOString();
  const locationKey = `${candidate.category}#${candidate.lat.toFixed(3)}#${candidate.lng.toFixed(3)}`;
  const duplicates = await database.send(new QueryCommand({
    TableName: tableName,
    IndexName: "DuplicateLookup",
    KeyConditionExpression: "#locationKey = :locationKey AND #createdAt BETWEEN :cutoff AND :now",
    ExpressionAttributeNames: { "#locationKey": "locationKey", "#createdAt": "createdAt" },
    ExpressionAttributeValues: {
      ":locationKey": locationKey,
      ":cutoff": new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
      ":now": createdAt
    },
    Limit: 1
  }));
  if (duplicates.Items?.length) throw new ValidationError("A similar report already exists for this approximate location.");

  const report = {
    reportId: randomUUID(), ...candidate, status: "unverified", createdAt, locationKey
  };
  await database.send(new PutCommand({ TableName: tableName, Item: report, ConditionExpression: "attribute_not_exists(reportId)" }));
  return publicReport(report);
}

async function updateStatus(event) {
  if (!moderatorAuthorized(event)) return response(401, { message: "Moderator authorization is required." }, event.headers?.origin);
  const status = decodeBody(event).status;
  if (!["unverified", "verified", "closed"].includes(status)) throw new ValidationError("Status must be unverified, verified, or closed.");
  const reportId = event.pathParameters?.reportId;
  if (!reportId) throw new ValidationError("Report ID is required.");
  const updatedAt = new Date().toISOString();
  try {
    const result = await database.send(new UpdateCommand({
      TableName: tableName,
      Key: { reportId },
      UpdateExpression: "SET #status = :status, #updatedAt = :updatedAt",
      ExpressionAttributeNames: { "#status": "status", "#updatedAt": "updatedAt" },
      ExpressionAttributeValues: { ":status": status, ":updatedAt": updatedAt },
      ConditionExpression: "attribute_exists(reportId)",
      ReturnValues: "ALL_NEW"
    }));
    return response(200, { report: publicReport(result.Attributes) }, event.headers?.origin);
  } catch (error) {
    if (error.name === "ConditionalCheckFailedException") return response(404, { message: "Report not found." }, event.headers?.origin);
    throw error;
  }
}

export async function handler(event) {
  const method = event.requestContext?.http?.method || event.httpMethod || "GET";
  const rawPath = event.rawPath || event.path || "/";
  const stage = event.requestContext?.stage;
  const path = stage && rawPath.startsWith(`/${stage}/`) ? rawPath.slice(stage.length + 1) : rawPath;
  const origin = event.headers?.origin;
  try {
    if (method === "OPTIONS") return response(204, null, origin);
    if (method === "GET" && path === "/reports") return response(200, await listReports(event), origin);
    if (method === "POST" && path === "/reports") return response(201, { report: await createReport(event) }, origin);
    const reportPath = path.match(/^\/reports\/([^/]+)$/);
    if (method === "GET" && reportPath) return getReport(decodeURIComponent(reportPath[1]), origin);
    if (method === "PATCH" && /^\/reports\/[^/]+\/status$/.test(path)) return updateStatus(event);
    return response(404, { message: "Route not found." }, origin);
  } catch (error) {
    if (error instanceof ValidationError) return response(400, { message: error.message }, origin);
    console.error("Report API request failed:", error.message);
    return response(500, { message: "The report service could not complete this request." }, origin);
  }
}