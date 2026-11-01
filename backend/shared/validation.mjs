export const CATEGORIES = new Set([
  "flood",
  "road-blockage",
  "damaged-road",
  "service-disruption",
  "public-facility",
  "community-location"
]);

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
  }
}

function cleanText(value, field, minimum, maximum) {
  if (typeof value !== "string") throw new ValidationError(`${field} must be text.`);
  const cleaned = value.normalize("NFC").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  if (cleaned.length < minimum || cleaned.length > maximum) {
    throw new ValidationError(`${field} must contain ${minimum} to ${maximum} characters.`);
  }
  return cleaned;
}

function validateImage(imageDataUrl) {
  if (imageDataUrl === undefined || imageDataUrl === "") return undefined;
  if (typeof imageDataUrl !== "string" || imageDataUrl.length > 170000
    || !/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(imageDataUrl)) {
    throw new ValidationError("Photo must be JPEG, PNG, or WebP and no larger than 120 KB.");
  }
  const encoded = imageDataUrl.slice(imageDataUrl.indexOf(",") + 1);
  if (Buffer.from(encoded, "base64").length > 120 * 1024) {
    throw new ValidationError("Photo must be no larger than 120 KB.");
  }
  return imageDataUrl;
}

export function validateReport(input, now = Date.now()) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new ValidationError("A report object is required.");
  }
  const title = cleanText(input.title, "Title", 5, 90);
  const locationName = cleanText(input.locationName, "Location", 3, 100);
  const description = cleanText(input.description, "Description", 10, 500);
  if (!CATEGORIES.has(input.category)) throw new ValidationError("Choose a supported report category.");

  const lat = input.lat;
  const lng = input.lng;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 21.4 || lat > 27.3 || lng < 85.7 || lng > 89.9) {
    throw new ValidationError("Choose a map point within West Bengal.");
  }
  const reportedAt = Date.parse(input.reportedAt);
  if (!Number.isFinite(reportedAt) || reportedAt > now || now - reportedAt > 30 * 24 * 60 * 60 * 1000) {
    throw new ValidationError("Observation time must be within the past 30 days.");
  }

  const imageDataUrl = validateImage(input.imageDataUrl);
  return {
    category: input.category,
    title,
    locationName,
    description,
    lat: Number(lat.toFixed(3)),
    lng: Number(lng.toFixed(3)),
    reportedAt: new Date(reportedAt).toISOString(),
    ...(imageDataUrl ? { imageDataUrl } : {})
  };
}