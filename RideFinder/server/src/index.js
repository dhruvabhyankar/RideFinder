import express from "express";
import cors from "cors";
import "dotenv/config";
import { query, initPool, closePool } from "./db.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const app = express();
const PORT = Number(process.env.PORT || 4000);

app.use(cors({ origin: ["http://localhost:5173", "http://127.0.0.1:5173"] }));

app.use(express.json({ limit: "1mb" }));

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.warn("JWT_SECRET is not set in server/.env. Add a long random secret before using accounts.");
}
function createToken(user) {
  return jwt.sign({ userId: user.USER_ID, email: user.EMAIL }, JWT_SECRET || "development-only-change-me", { expiresIn: "7d" });
}
function requireAuth(req, res, next) {
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "Please log in to continue." });
  try {
    req.user = jwt.verify(token, JWT_SECRET || "development-only-change-me");
    next();
  } catch {
    return res.status(401).json({ error: "Your session has expired. Please log in again." });
  }
}

app.post("/api/auth/register", async (req, res, next) => {
  try {
    const name = String(req.body?.name || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    const phone = String(req.body?.phone || "").trim();
    if (name.length < 2 || name.length > 150) return res.status(400).json({ error: "Enter your full name." });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return res.status(400).json({ error: "Enter a valid email address." });
    if (password.length < 8 || password.length > 72) return res.status(400).json({ error: "Password must be at least 8 characters." });
    if (phone && !/^[+()\-\s\d]{7,30}$/.test(phone)) return res.status(400).json({ error: "Enter a valid phone number." });
    const existing = await query("SELECT USER_ID FROM USERS WHERE EMAIL = :email", { email });
    if (existing.rows.length) return res.status(409).json({ error: "An account with this email already exists." });
    const hash = await bcrypt.hash(password, 12);
    const oracledb = (await import("oracledb")).default;
    const result = await query(
      `INSERT INTO USERS (FULL_NAME, EMAIL, PASSWORD_HASH, PHONE)
       VALUES (:name, :email, :hash, :phone)
       RETURNING USER_ID INTO :userId`,
      { name, email, hash, phone: phone || null,
        userId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } },
      { autoCommit: true }
    );
    const user = { USER_ID: result.outBinds.userId[0], FULL_NAME: name, EMAIL: email, PHONE: phone || null };
    res.status(201).json({ token: createToken(user), user: { id: user.USER_ID, name, email, phone: user.PHONE } });
  } catch (e) { next(e); }
});

app.post("/api/auth/login", async (req, res, next) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    const result = await query(
      "SELECT USER_ID, FULL_NAME, EMAIL, PHONE, PASSWORD_HASH FROM USERS WHERE EMAIL = :email",
      { email }
    );
    if (!result.rows.length || !(await bcrypt.compare(password, result.rows[0].PASSWORD_HASH))) {
      return res.status(401).json({ error: "Email or password is incorrect." });
    }
    const row = result.rows[0];
    res.json({
      token: createToken(row),
      user: { id: row.USER_ID, name: row.FULL_NAME, email: row.EMAIL, phone: row.PHONE }
    });
  } catch (e) { next(e); }
});

app.get("/api/auth/me", requireAuth, async (req, res, next) => {
  try {
    const result = await query(
      "SELECT USER_ID, FULL_NAME, EMAIL, PHONE FROM USERS WHERE USER_ID = :id",
      { id: req.user.userId }
    );
    if (!result.rows.length) return res.status(401).json({ error: "Account not found." });
    const row = result.rows[0];
    res.json({ id: row.USER_ID, name: row.FULL_NAME, email: row.EMAIL, phone: row.PHONE });
  } catch (e) { next(e); }
});

app.get("/api/my-bookings", requireAuth, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT b.BOOKING_ID, b.BIKE_ID, b.CUSTOMER_NAME, b.CUSTOMER_EMAIL,
              b.CUSTOMER_PHONE, b.CUSTOMER_CITY, b.NOTES, b.BOOKING_STATUS, b.CREATED_AT,
              k.NAME AS BIKE_NAME, k.BRAND AS BIKE_BRAND, k.PRICE AS BIKE_PRICE,
              k.IMAGES_URL
       FROM BOOKINGS b JOIN BIKES k ON k.BIKE_ID = b.BIKE_ID
       WHERE b.USER_ID = :userId
       ORDER BY b.CREATED_AT DESC`,
      { userId: req.user.userId }
    );
    res.json({ items: result.rows });
  } catch (e) { next(e); }
});


const numeric = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

app.get("/api/health", async (_req, res) => {
  try {
    await query("SELECT 1 AS OK FROM DUAL");
    res.json({ ok: true, database: "connected" });
  } catch (error) {
    res.status(503).json({ ok: false, error: "Database connection failed", detail: error.message });
  }
});

app.get("/api/filters", async (_req, res, next) => {
  try {
    const [brands, ranges] = await Promise.all([
      query("SELECT DISTINCT BRAND FROM BIKES WHERE BRAND IS NOT NULL ORDER BY BRAND"),
      query(`SELECT MIN(PRICE) AS MIN_PRICE, MAX(PRICE) AS MAX_PRICE,
                    MIN(DISPLACEMENT) AS MIN_CC, MAX(DISPLACEMENT) AS MAX_CC
             FROM BIKES`)
    ]);
    res.json({
      brands: brands.rows.map(r => r.BRAND),
      ranges: ranges.rows[0] || {}
    });
  } catch (e) { next(e); }
});

app.get("/api/bikes", async (req, res, next) => {
  try {
    const q = String(req.query.q || "").trim().slice(0, 100);
    const brand = String(req.query.brand || "").trim().slice(0, 100);
    const minPrice = numeric(req.query.minPrice);
    const maxPrice = numeric(req.query.maxPrice);
    const minCc = numeric(req.query.minCc);
    const maxCc = numeric(req.query.maxCc);
    const minMileage = numeric(req.query.minMileage);
    const sortMap = {
      price_asc: "PRICE ASC NULLS LAST",
      price_desc: "PRICE DESC NULLS LAST",
      mileage_desc: "MILEAGE_ARAI DESC NULLS LAST",
      displacement_desc: "DISPLACEMENT DESC NULLS LAST",
      power_desc: "MAX_POWER DESC NULLS LAST",
      name_asc: "NAME ASC"
    };
    const sort = sortMap[String(req.query.sort || "price_asc")] || sortMap.price_asc;
    const page = Math.max(1, Math.min(10000, Number.parseInt(req.query.page || "1", 10) || 1));
    const limit = Math.max(1, Math.min(48, Number.parseInt(req.query.limit || "12", 10) || 12));
    const offset = (page - 1) * limit;

    const where = `
      WHERE (:q IS NULL OR LOWER(NAME) LIKE '%' || LOWER(:q) || '%' OR LOWER(BRAND) LIKE '%' || LOWER(:q) || '%')
        AND (:brand IS NULL OR BRAND = :brand)
        AND (:minPrice IS NULL OR PRICE >= :minPrice)
        AND (:maxPrice IS NULL OR PRICE <= :maxPrice)
        AND (:minCc IS NULL OR DISPLACEMENT >= :minCc)
        AND (:maxCc IS NULL OR DISPLACEMENT <= :maxCc)
        AND (:minMileage IS NULL OR MILEAGE_ARAI >= :minMileage OR (MILEAGE_ARAI IS NULL AND MILEAGE_OWNER_REPORTED >= :minMileage))
    `;
    const binds = { q: q || null, brand: brand || null, minPrice, maxPrice, minCc, maxCc, minMileage };
    const countResult = await query(`SELECT COUNT(*) AS TOTAL FROM BIKES ${where}`, binds);
    const result = await query(
      `SELECT BIKE_ID, NAME, BRAND, PRICE, MAX_POWER, MAX_TORQUE,
              DISPLACEMENT, MILEAGE_ARAI, MILEAGE_OWNER_REPORTED,
              TRANSMISSION, KERB_WEIGHT, SEAT_HEIGHT, IMAGES_URL
       FROM BIKES ${where}
       ORDER BY ${sort}
       OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`,
      { ...binds, offset, limit }
    );
    res.json({ items: result.rows, total: countResult.rows[0].TOTAL, page, limit });
  } catch (e) { next(e); }
});

app.get("/api/bikes/:id", async (req, res, next) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: "Invalid bike ID" });
    const result = await query("SELECT * FROM BIKES WHERE BIKE_ID = :id", { id });
    if (!result.rows.length) return res.status(404).json({ error: "Bike not found" });
    res.json(result.rows[0]);
  } catch (e) { next(e); }
});


app.post("/api/bookings", requireAuth, async (req, res, next) => {
  try {
    const bikeId = Number.parseInt(req.body?.bikeId, 10);
    const name = String(req.body?.customerName || "").trim();
    const email = String(req.body?.customerEmail || "").trim();
    const phone = String(req.body?.customerPhone || "").trim();
    const city = String(req.body?.customerCity || "").trim();
    const notes = String(req.body?.notes || "").trim();

    if (!Number.isInteger(bikeId) || bikeId < 1) {
      return res.status(400).json({ error: "Please select a valid bike." });
    }
    if (name.length < 2 || name.length > 150) {
      return res.status(400).json({ error: "Enter a name between 2 and 150 characters." });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return res.status(400).json({ error: "Enter a valid email address." });
    }
    if (!/^[+()\-\s\d]{7,30}$/.test(phone)) {
      return res.status(400).json({ error: "Enter a valid phone number." });
    }
    if (city.length > 100 || notes.length > 1000) {
      return res.status(400).json({ error: "City or notes are too long." });
    }

    const bike = await query("SELECT BIKE_ID, NAME FROM BIKES WHERE BIKE_ID = :id", { id: bikeId });
    if (!bike.rows.length) return res.status(404).json({ error: "That bike could not be found." });

    const result = await query(
      `INSERT INTO BOOKINGS
       (BIKE_ID, USER_ID, CUSTOMER_NAME, CUSTOMER_EMAIL, CUSTOMER_PHONE, CUSTOMER_CITY, NOTES, BOOKING_STATUS)
       VALUES (:bikeId, :userId, :name, :email, :phone, :city, :notes, 'REQUESTED')
       RETURNING BOOKING_ID INTO :bookingId`,
      {
        bikeId, userId: req.user.userId, name, email, phone, city: city || null, notes: notes || null,
        bookingId: { dir: (await import("oracledb")).default.BIND_OUT, type: (await import("oracledb")).default.NUMBER }
      },
      { autoCommit: true }
    );
    res.status(201).json({
      success: true,
      demo: true,
      bookingId: result.outBinds.bookingId[0],
      bikeName: bike.rows[0].NAME,
      message: "Booking request submitted successfully."
    });
  } catch (e) { next(e); }
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server", detail: process.env.NODE_ENV === "development" ? err.message : undefined });
});

await initPool();
const server = app.listen(PORT, () => console.log(`RideFinder API listening at http://localhost:${PORT}`));

async function shutdown() {
  server.close();
  await closePool();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
