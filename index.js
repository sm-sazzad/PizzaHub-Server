import express from "express";
import cors from "cors";
import "dotenv/config";
import { MongoClient, ObjectId } from "mongodb";

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
  const result = await menu.find({ status: "approved" }).toArray();
  res.send(result);
});

app.patch("/menu/:id", async (req, res) => {
  const { id } = req.params;
  console.log(req.body.status);
  const query = { _id: new ObjectId(id) };
  const updateDoc = {
    $set: {
      status: req.body.status,
    },
  };

  const result = await menu.updateOne(query, updateDoc);
  res.send(result);
});

app.delete("/menu/:id", async (req, res) => {
  const { id } = req.params;
  const query = { _id: new ObjectId(id) };
  const result = await menu.deleteOne(query);
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
