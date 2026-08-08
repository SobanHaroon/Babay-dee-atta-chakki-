import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const TABLE_NAME = "delivery_areas_charges";
const DEFAULT_CSV_PATH = "C:/Users/karpe/Downloads/Babey_Dee_Delivery_Areas_Rawalpindi_Islamabad.csv";
const DEFAULT_XLSX_PATH = "C:/Users/karpe/Downloads/Babey_Dee_Delivery_Areas_Rawalpindi_Islamabad.xlsx";
const DEFAULT_RATE_PER_KM = 50;
const MIN_DELIVERY_CHARGE = 50;
const BATCH_SIZE = 100;

const SOURCE_HEADERS = {
  id: "ID",
  city: "City",
  areaName: "Area / Neighborhood / Sector",
  category: "Category",
  distanceKm: "Distance from Gulraiz Phase 3 (km)",
  ratePerKm: "Delivery Rate (Rs/km)",
  deliveryCharge: "Delivery Charge (Rs)",
  available: "Delivery Available",
  pricingNote: "Recommended Pricing Note",
} as const;

type SourceRecord = Record<string, string>;
type CanonicalRecord = {
  id: string;
  city: "Rawalpindi" | "Islamabad";
  areaName: string;
  category: string;
  distanceKm: number;
  ratePerKm: number;
  deliveryCharge: number;
  available: boolean;
  pricingNote: string;
};

type DeliveryColumns = {
  id: string;
  city: string;
  areaName: string;
  category: string;
  distanceKm: string;
  ratePerKm: string;
  deliveryCharge: string;
  available: string;
  pricingNote: string;
};

function cleanText(value: unknown): string {
  return String(value ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeHeader(value: string): string {
  return cleanText(value).toLowerCase().replace(/[()]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && quoted && nextChar === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(cell);
      cell = "";
    } else {
      cell += char;
    }
  }

  cells.push(cell);
  return cells;
}

function readCsv(filePath: string): SourceRecord[] {
  const text = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) throw new Error(`CSV source is empty: ${filePath}`);

  const headers = parseCsvLine(lines[0]).map(cleanText);
  return lines.slice(1).map((line, rowIndex) => {
    const values = parseCsvLine(line);
    const record: SourceRecord = {};
    headers.forEach((header, columnIndex) => {
      record[header] = cleanText(values[columnIndex]);
    });

    if (!record[SOURCE_HEADERS.id]) {
      throw new Error(`CSV row ${rowIndex + 2} is missing ID`);
    }
    return record;
  });
}

function readCanonicalRecords(filePath: string): CanonicalRecord[] {
  const sourceRows = readCsv(filePath);
  const records: CanonicalRecord[] = [];

  for (const row of sourceRows) {
    const city = cleanText(row[SOURCE_HEADERS.city]);
    const areaName = cleanText(row[SOURCE_HEADERS.areaName]);
    const distanceKm = Number(row[SOURCE_HEADERS.distanceKm]);
    const ratePerKm = Number(row[SOURCE_HEADERS.ratePerKm] || DEFAULT_RATE_PER_KM);
    const sourceCharge = Number(row[SOURCE_HEADERS.deliveryCharge]);
    const availableValue = cleanText(row[SOURCE_HEADERS.available]).toUpperCase();

    if (city !== "Rawalpindi" && city !== "Islamabad") {
      throw new Error(`Unsupported city for ${row[SOURCE_HEADERS.id]}: ${city}`);
    }
    if (!areaName) throw new Error(`Missing area name for ${row[SOURCE_HEADERS.id]}`);
    if (!Number.isFinite(distanceKm) || distanceKm < 0) throw new Error(`Invalid distance for ${row[SOURCE_HEADERS.id]}`);
    if (!Number.isFinite(ratePerKm) || ratePerKm < 0) throw new Error(`Invalid rate for ${row[SOURCE_HEADERS.id]}`);
    if (!Number.isFinite(sourceCharge) || sourceCharge < 0) throw new Error(`Invalid source charge for ${row[SOURCE_HEADERS.id]}`);
    if (availableValue !== "YES" && availableValue !== "NO") {
      throw new Error(`Invalid availability for ${row[SOURCE_HEADERS.id]}: ${availableValue}`);
    }

    const normalizedDistance = Math.ceil(distanceKm);
    const calculatedCharge = Math.max(MIN_DELIVERY_CHARGE, normalizedDistance * ratePerKm);
    if (sourceCharge !== calculatedCharge) {
      throw new Error(`Source charge mismatch for ${row[SOURCE_HEADERS.id]}: source=${sourceCharge}, calculated=${calculatedCharge}`);
    }

    records.push({
      id: cleanText(row[SOURCE_HEADERS.id]),
      city: city as CanonicalRecord["city"],
      areaName,
      category: cleanText(row[SOURCE_HEADERS.category]),
      distanceKm: normalizedDistance,
      ratePerKm,
      deliveryCharge: calculatedCharge,
      available: availableValue === "YES",
      pricingNote: cleanText(row[SOURCE_HEADERS.pricingNote]),
    });
  }

  return deduplicateRecords(records);
}

function deduplicateRecords(records: CanonicalRecord[]): CanonicalRecord[] {
  const seenIds = new Set<string>();
  const seenAreas = new Set<string>();
  const unique: CanonicalRecord[] = [];

  for (const record of records) {
    const idKey = record.id.toLowerCase();
    const areaKey = `${record.city.toLowerCase()}::${record.areaName.toLowerCase()}`;
    if (seenIds.has(idKey) || seenAreas.has(areaKey)) continue;
    seenIds.add(idKey);
    seenAreas.add(areaKey);
    unique.push(record);
  }

  return unique;
}

function getEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : undefined;
}

function quoteColumn(column: string): string {
  return `"${column.replace(/"/g, '""')}"`;
}

async function findColumn(client: SupabaseClient, envName: string, candidates: string[]): Promise<string> {
  const configured = getEnv(envName);
  const options = configured ? [configured] : candidates;

  for (const candidate of options) {
    const result = await client.from(TABLE_NAME).select(quoteColumn(candidate), { head: true }).limit(0);
    if (!result.error) return candidate;
  }

  throw new Error(`Could not find ${envName} in ${TABLE_NAME}. Tried: ${options.join(", ")}`);
}

async function resolveColumns(client: SupabaseClient): Promise<DeliveryColumns> {
  return {
    id: await findColumn(client, "DELIVERY_ID_COLUMN", ["id"]),
    city: await findColumn(client, "DELIVERY_CITY_COLUMN", ["City", "city"]),
    areaName: await findColumn(client, "DELIVERY_AREA_COLUMN", [
      "Area/Neighborhood/Sector",
      "Area / Neighborhood / Sector",
      "area / neighborhood / sector",
      "area_name",
      "area name",
      "Area",
      "area",
      "neighborhood",
    ]),
    category: await findColumn(client, "DELIVERY_CATEGORY_COLUMN", ["category", "Category"]),
    distanceKm: await findColumn(client, "DELIVERY_DISTANCE_COLUMN", [
      "distance from store (KM)",
      "Distance from Gulraiz Phase 3 (km)",
      "distance from gulraiz phase 3 km",
      "distance_km",
      "distance km",
      "distance",
    ]),
    ratePerKm: await findColumn(client, "DELIVERY_RATE_COLUMN", [
      "delivery rate (Rs/Km)",
      "delivery rate (Rs/km)",
      "delivery_rate_per_km",
      "rate_per_km",
      "rate per km",
    ]),
    deliveryCharge: await findColumn(client, "DELIVERY_CHARGE_COLUMN", [
      "delivery charges (Rs)",
      "delivery charge (Rs)",
      "delivery_charge",
      "delivery_charge_rs",
    ]),
    available: await findColumn(client, "DELIVERY_AVAILABLE_COLUMN", [
      "delivery aviable",
      "Delivery Available",
      "delivery available",
      "delivery_available",
      "available",
    ]),
    pricingNote: await findColumn(client, "DELIVERY_NOTE_COLUMN", [
      "recommended Pricing Note",
      "recommended pricing note",
      "pricing_note",
      "recommended_pricing_note",
    ]),
  };
}

function databaseIdForRecord(record: CanonicalRecord): number {
  const sourceIdMatch = record.id.match(/^DEL-(\d+)$/i);
  const numericId = Number(sourceIdMatch?.[1] || record.id);
  if (!Number.isSafeInteger(numericId) || numericId < 1) {
    throw new Error(`The existing bigint id column cannot store source ID ${record.id}. Set DELIVERY_ID_COLUMN to a text source-ID column if one exists.`);
  }
  return numericId;
}

function toDatabaseRecord(record: CanonicalRecord, columns: DeliveryColumns): Record<string, string | number | boolean> {
  return {
    [columns.id]: databaseIdForRecord(record),
    [columns.city]: record.city,
    [columns.areaName]: record.areaName,
    [columns.category]: record.category,
    [columns.distanceKm]: record.distanceKm,
    [columns.ratePerKm]: record.ratePerKm,
    [columns.deliveryCharge]: record.deliveryCharge,
    [columns.available]: record.available,
    [columns.pricingNote]: record.pricingNote,
  };
}

async function upsertRecords(client: SupabaseClient, records: CanonicalRecord[], columns: DeliveryColumns): Promise<void> {
  const payload = records.map((record) => toDatabaseRecord(record, columns));
  for (let index = 0; index < payload.length; index += BATCH_SIZE) {
    const batch = payload.slice(index, index + BATCH_SIZE);
    const result = await client.from(TABLE_NAME).upsert(batch, { onConflict: columns.id });
    if (result.error) {
      throw new Error(`Delivery upsert failed for batch ${index}-${index + batch.length - 1}: ${result.error.message}`);
    }
  }
}

async function verify(client: SupabaseClient, records: CanonicalRecord[], columns: DeliveryColumns) {
  const selectedColumns = [columns.id, columns.city, columns.areaName, columns.distanceKm, columns.ratePerKm, columns.deliveryCharge, columns.available]
    .map(quoteColumn)
    .join(",");
  const result = await client.from(TABLE_NAME).select(selectedColumns);
  if (result.error) throw new Error(`Delivery verification query failed: ${result.error.message}`);

  const rows = (result.data ?? []) as unknown as Record<string, unknown>[];
  const countByCity = rows.reduce<Record<string, number>>((acc, row) => {
    const city = cleanText(row[columns.city]);
    acc[city] = (acc[city] || 0) + 1;
    return acc;
  }, {});
  const rowById = new Map(rows.map((row) => [cleanText(row[columns.id]), row]));
  const rowBySourceId = new Map(records.map((record) => [record.id, rowById.get(String(databaseIdForRecord(record)))]));
  const sampleNames = [
    "Gulraiz Phase 3",
    "Bahria Town Phase 1",
    "Bahria Town Phase 8",
    "PWD Housing Society",
    "Satellite Town",
    "Saddar",
    "DHA Phase 2",
    "F-7",
    "G-10",
    "Blue Area",
  ];
  const samples = sampleNames.map((areaName) => {
    const expected = records.find((record) => record.areaName === areaName || record.areaName.includes(areaName));
    const row = expected ? rowBySourceId.get(expected.id) : undefined;
    return {
      requested: areaName,
      found: Boolean(row),
      id: expected?.id ?? null,
      city: row ? cleanText(row[columns.city]) : null,
      distanceKm: row ? Number(row[columns.distanceKm]) : null,
      deliveryCharge: row ? Number(row[columns.deliveryCharge]) : null,
    };
  });

  const missingIds = records.filter((record) => !rowBySourceId.get(record.id)).map((record) => record.id);
  if (missingIds.length > 0) throw new Error(`Verification failed; missing ${missingIds.length} imported IDs. First missing: ${missingIds.slice(0, 5).join(", ")}`);

  return { table: TABLE_NAME, recordCount: rows.length, countByCity, samples };
}

async function main() {
  const csvPath = path.resolve(getEnv("DELIVERY_SOURCE_CSV") || DEFAULT_CSV_PATH);
  const xlsxPath = path.resolve(getEnv("DELIVERY_SOURCE_XLSX") || DEFAULT_XLSX_PATH);
  const verifyOnly = process.argv.includes("--verify-only");
  const secretKey = getEnv("SUPABASE_SECRET_KEY");
  const dbUrl = getEnv("SUPABASE_URL") || getEnv("VITE_SUPABASE_URL");

  if (!secretKey) throw new Error("SUPABASE_SECRET_KEY is required. Refusing to write with a publishable key because delivery table RLS must remain enabled.");
  if (!dbUrl) throw new Error("SUPABASE_URL is required for the server-side import.");
  if (!fs.existsSync(csvPath)) throw new Error(`CSV source was not found: ${csvPath}`);
  if (!fs.existsSync(xlsxPath)) throw new Error(`Excel source was not found: ${xlsxPath}`);

  const records = readCanonicalRecords(csvPath);
  const client = createClient(dbUrl, secretKey);
  const columns = await resolveColumns(client);

  if (!verifyOnly) await upsertRecords(client, records, columns);
  const verification = await verify(client, records, columns);

  console.log(JSON.stringify({
    source: { csvPath, xlsxPath, csvRecords: records.length, excelPresent: true },
    columns,
    pricing: { defaultRatePerKm: DEFAULT_RATE_PER_KM, minimumDeliveryCharge: MIN_DELIVERY_CHARGE },
    mode: verifyOnly ? "verify-only" : "upsert-and-verify",
    verification,
  }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
