import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import "dotenv/config";
import oracledb from "oracledb";
import { initPool, closePool } from "./db.js";

const filePath = path.resolve("data", "bikesCleaned_100_for_website(1).csv");
if (!fs.existsSync(filePath)) {
  console.error(`CSV not found: ${filePath}\nCopy your supplied CSV into server/data/ with that exact filename.`);
  process.exit(1);
}

const headerMap = {
  "name":"NAME", "brand":"BRAND", "price":"PRICE", "max power":"MAX_POWER",
  "max torque":"MAX_TORQUE", "cooling system":"COOLING_SYSTEM",
  "transmission":"TRANSMISSION", "transmission type":"TRANSMISSION_TYPE",
  "displacement":"DISPLACEMENT", "cylinders":"CYLINDERS", "bore":"BORE", "stroke":"STROKE",
  "valves per cylinder":"VALVES_PER_CYLINDER", "spark plugs":"SPARK_PLUGS",
  "gear shifting pattern":"GEAR_SHIFTING_PATTERN", "clutch":"CLUTCH",
  "fuel tank capacity":"FUEL_TANK_CAPACITY", "mileage - arai":"MILEAGE_ARAI",
  "mileage - owner reported":"MILEAGE_OWNER_REPORTED", "top speed":"TOP_SPEED",
  "braking system":"BRAKING_SYSTEM", "front brake type":"FRONT_BRAKE_TYPE",
  "front brake size":"FRONT_BRAKE_SIZE", "rear tyre size":"REAR_TYRE_SIZE",
  "tyre type":"TYRE_TYPE", "radial tyres":"RADIAL_TYRES", "rear brake type":"REAR_BRAKE_TYPE",
  "rear brake size":"REAR_BRAKE_SIZE", "wheel type":"WHEEL_TYPE",
  "front wheel size":"FRONT_WHEEL_SIZE", "rear wheel size":"REAR_WHEEL_SIZE",
  "front tyre size":"FRONT_TYRE_SIZE", "front tyre pressure (rider)":"FRONT_TYRE_PRESSURE_RIDER",
  "rear tyre pressure (rider)":"REAR_TYRE_PRESSURE_RIDER",
  "front tyre pressure (rider & pillion)":"FRONT_TYRE_PRESSURE_RIDER_PILLION",
  "rear tyre pressure (rider & pillion)":"REAR_TYRE_PRESSURE_RIDER_PILLION",
  "kerb weight":"KERB_WEIGHT", "overall length":"OVERALL_LENGTH", "overall width":"OVERALL_WIDTH",
  "wheelbase":"WHEELBASE", "ground clearance":"GROUND_CLEARANCE", "seat height":"SEAT_HEIGHT",
  "overall height":"OVERALL_HEIGHT", "chassis type":"CHASSIS_TYPE", "images_url":"IMAGES_URL"
};

const numericColumns = new Set([
  "PRICE","MAX_POWER","MAX_TORQUE","DISPLACEMENT","CYLINDERS","BORE","STROKE",
  "VALVES_PER_CYLINDER","FUEL_TANK_CAPACITY","MILEAGE_ARAI","MILEAGE_OWNER_REPORTED",
  "TOP_SPEED","FRONT_BRAKE_SIZE","REAR_BRAKE_SIZE","FRONT_WHEEL_SIZE","REAR_WHEEL_SIZE",
  "FRONT_TYRE_PRESSURE_RIDER","REAR_TYRE_PRESSURE_RIDER",
  "FRONT_TYRE_PRESSURE_RIDER_PILLION","REAR_TYRE_PRESSURE_RIDER_PILLION",
  "KERB_WEIGHT","OVERALL_LENGTH","OVERALL_WIDTH","WHEELBASE","GROUND_CLEARANCE",
  "SEAT_HEIGHT","OVERALL_HEIGHT"
]);

const records = parse(fs.readFileSync(filePath, "utf8"), {
  columns: true, skip_empty_lines: true, bom: true, trim: true, relax_column_count: true
});
const columns = Object.keys(headerMap);
const sqlColumns = columns.map(c => headerMap[c]);
const placeholders = sqlColumns.map((_, i) => `:${i + 1}`).join(", ");
const sql = `INSERT INTO BIKES (${sqlColumns.join(", ")}) VALUES (${placeholders})`;

const p = await initPool();
let connection;
try {
  connection = await p.getConnection();
  // This is a one-time initial import. Clear existing records to avoid duplicate imports.
  await connection.execute("DELETE FROM BIKES");
  let imported = 0;
  for (const record of records) {
    if (!record.name?.trim()) continue;
    const values = columns.map(c => {
      const value = record[c] === undefined ? null : String(record[c]).trim();
      if (value === "" || value === "nan" || value === "NaN" || value === "null") return null;
      const col = headerMap[c];
      if (numericColumns.has(col)) {
        const n = Number(value.replace(/,/g, ""));
        return Number.isFinite(n) ? n : null;
      }
      return value;
    });
    await connection.execute(sql, values, { autoCommit: false });
    imported++;
  }
  await connection.commit();
  console.log(`Imported ${imported} bike records from ${path.basename(filePath)}.`);
} catch (error) {
  if (connection) await connection.rollback();
  console.error("CSV import failed:", error.message);
  process.exitCode = 1;
} finally {
  if (connection) await connection.close();
  await closePool();
}
