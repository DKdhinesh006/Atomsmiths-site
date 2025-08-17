import { MongoClient } from "mongodb";

let cached = global._mongo;
if (!cached) {
  cached = global._mongo = { conn: null, promise: null };
}

async function connectToDatabase(uri) {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
    cached.promise = client.connect().then((client) => {
      return { client, db: client.db(process.env.MONGODB_DB || "atomsmiths") };
    });
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch {}
  }
  const { name, email, department, year, interests } = body || {};
  if (!name || !email) {
    res.status(400).json({ error: "name and email are required" });
    return;
  }
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!emailOk) {
    res.status(400).json({ error: "invalid email" });
    return;
  }

  try {
    const { db } = await connectToDatabase(process.env.MONGODB_URI);
    await db.collection("members").insertOne({
      name, email, department: department || null, year: year || null,
      interests: interests || null, createdAt: new Date()
    });
    res.status(200).json({ ok: true, message: "Thanks for joining!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
}
