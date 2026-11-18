import express from "express";
import cors from "cors";
import "dotenv/config";
import { MongoClient } from "mongodb";

const port = process.env.PORT || 5000;
const app = express();

app.use(cors());
app.use(express.json());

const client = new MongoClient(process.env.MONGODB_URL);
export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.dir(err);
  }
}
await connectToMongoDB();

const database = client.db("PizzaHub");
const menu = database.collection("menu");

app.get("/", (req, res) => {
  res.send("wellcome");
});

app.get("/menu", async (req, res) => {
  const vendorEmail = req.query.vendorEmail;
  if (vendorEmail) {
    const result = await menu.find({ vendorEmail }).toArray();
    res.send(result);
    return;
  }
  console.log(vendorEmail);
  const result = await menu.find({}).toArray();
  res.send(result);
});

app.post("/menu", async (req, res) => {
  const newItem = req.body;
  const result = await menu.insertOne(newItem);
  res.send(result);
});

app.listen(port, () => {
  console.log("running");
});

export default app;
