import test from "node:test";
import assert from "node:assert/strict";
import { validateReport, ValidationError } from "../shared/validation.mjs";

const validReport = {
  category: "flood",
  title: "Water across public road",
  locationName: "Near public bus stop",
  description: "A shallow water pool is visible across one lane.",
  lat: 22.57261,
  lng: 88.36391,
  reportedAt: "2026-11-01T10:00:00.000Z"
};
const testNow = Date.parse("2026-11-01T11:00:00.000Z");

test("accepts and rounds a valid report point", () => {
  const report = validateReport(validReport, testNow);
  assert.equal(report.lat, 22.573);
  assert.equal(report.lng, 88.364);
  assert.equal(report.category, "flood");
});

test("rejects unsupported categories and out-of-region coordinates", () => {
  assert.throws(() => validateReport({ ...validReport, category: "other" }, testNow), ValidationError);
  assert.throws(() => validateReport({ ...validReport, lat: 19.1 }, testNow), /within West Bengal/);
});

test("rejects future or stale observation times", () => {
  const now = testNow;
  assert.throws(() => validateReport({ ...validReport, reportedAt: "2026-11-02T00:00:00.000Z" }, now), /Observation time/);
  assert.throws(() => validateReport({ ...validReport, reportedAt: "2026-09-01T00:00:00.000Z" }, now), /Observation time/);
});

test("normalizes text and rejects short or oversized descriptions", () => {
  const report = validateReport({ ...validReport, title: "  Water\n across road  " }, testNow);
  assert.equal(report.title, "Water across road");
  assert.throws(() => validateReport({ ...validReport, description: "short" }, testNow), /Description/);
  assert.throws(() => validateReport({ ...validReport, description: "x".repeat(501) }, testNow), /Description/);
});

test("rejects unsupported image formats and oversized uploads", () => {
  assert.throws(() => validateReport({ ...validReport, imageDataUrl: "data:image/svg+xml;base64,PHN2Zz4=" }, testNow), /Photo/);
  const largeImage = `data:image/png;base64,${Buffer.alloc(120 * 1024 + 1).toString("base64")}`;
  assert.throws(() => validateReport({ ...validReport, imageDataUrl: largeImage }, testNow), /120 KB/);
});