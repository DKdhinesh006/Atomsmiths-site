import { MongoClient } from "mongodb";

const uri = process.env.MONGO_URI;
let client = null;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST allowed" });
  }

  try {
    if (!client) {
      client = new MongoClient(uri);
      await client.connect();
    }

    const db = client.db("atomsmiths");
    const collection = db.collection("members");

    const data = req.body; // expects JSON
    const result = await collection.insertOne(data);

    res.status(200).json({ success: true, id: result.insertedId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
}
