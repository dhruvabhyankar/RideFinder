import oracledb from "oracledb";
import "dotenv/config";

let pool;

export async function initPool() {
  if (!pool) {
    pool = await oracledb.createPool({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
      poolMin: 1,
      poolMax: 5,
      poolIncrement: 1,
    });
  }
  return pool;
}

export async function query(sql, binds = {}, options = {}) {
  const p = await initPool();
  let connection;
  try {
    connection = await p.getConnection();
    const result = await connection.execute(sql, binds, {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
      fetchArraySize: 100,
      ...options,
    });
    return result;
  } finally {
    if (connection) await connection.close();
  }
}

export async function closePool() {
  if (pool) {
    await pool.close(10);
    pool = undefined;
  }
}
