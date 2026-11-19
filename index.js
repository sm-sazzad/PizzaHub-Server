import express from "express";
import cors from "cors";
import "dotenv/config";
import { MongoClient, ObjectId } from "mongodb";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

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
const premiumUser = database.collection("user");
const orders = database.collection("orders");

app.get("/", (req, res) => {
  res.send("wellcome");
});

app.get("/menu", async (req, res) => {
  const vendorEmail = req.query.vendorEmail;
  const id = req.query.id;
  if (id) {
    const query = { _id: new ObjectId(id) };
    const result = await menu.findOne(query);
    res.send(result);
    return;
  }
  if (vendorEmail) {
    const result = await menu.find({ vendorEmail }).toArray();
    res.send(result);
    return;
  }
  const result = await menu.find({ status: "approved" }).toArray();
  res.send(result);
});

app.get("/features", async (req, res) => {
  const result = await menu.find({ status: "approved" }).limit(6).toArray();
  res.send(result);
});

app.get("/orders", async (req, res) => {
  const email = req.query.email;
  const query = { $or: [{ vendorEmail: email }, { customerEmail: email }] };
  const result = await orders.find(query).toArray();
  res.send(result);
});

app.post("/orders", async (req, res) => {
  const newOrder = req.body;
  const result = await orders.insertOne(newOrder);
  res.send(result);
});

app.patch("/orders/:id/status", async (req, res) => {
  console.log(req.body, req.params);
  const { id } = req.params;
  const status = req.body;
  const query = { _id: new ObjectId(id) };
  const updatedDoc = {
    $set: {
      status: status.status,
    },
  };
  const result = await orders.updateOne(query, updatedDoc);
  res.send(result);
});

app.patch("/orders/:orderId/cancel", async (req, res) => {
  const orderId = req.params.orderId;
  const query = { _id: new ObjectId(orderId) };
  const updatedDoc = {
    $set: {
      status: "cancelled",
    },
  };
  const result = await orders.updateOne(query, updatedDoc);
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

app.patch("/premium-users", async (req, res) => {
  const { sessionId } = req.body;
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["line_items", "payment_intent"],
  });
  if (session?.status == "complete" && session.payment_status === "paid") {
    const Email = session?.customer_details?.email || null;
    const filter = { email: Email };
    const updateDoc = {
      $set: {
        subscriptionPlan: "premium",
      },
    };
    const result = await premiumUser.updateOne(filter, updateDoc);
    console.log(result);
    res.send(result);
    return;
  }
  return res.status(400).send({ message: "Payment not completed" });
});

// admin access
app.get("/admin/users", async (req, res) => {
  const result = await premiumUser.find().toArray();
  res.send(result);
});

app.get("/admin/menu", async (req, res) => {
  const result = await menu.find().toArray();
  res.send(result);
});

app.get("/admin/transactions", async (req, res) => {
  const result = await premiumUser
    .find({ subscriptionPlan: "premium" })
    .toArray();
  res.send(result);
});

app.patch("/admin/users/:id/role", async (req, res) => {
  const { id } = req.params;
  const query = { _id: new ObjectId(id) };
  const newRole = req.body;
  const updatedDoc = {
    $set: {
      role: newRole.role,
    },
  };
  const result = await premiumUser.updateOne(query, updatedDoc);
  res.send(result);
  console.log(result);
});

app.patch("/admin/users/:id/block", async (req, res) => {
  const { id } = req.params;
  const updateBlock = req.body;
  const query = { _id: new ObjectId(id) };
  const updatedDoc = {
    $set: {
      isBlocked: updateBlock.isBlocked,
    },
  };
  const result = await premiumUser.updateOne(query, updatedDoc);
  res.send(result);
  console.log(result);
});

app.listen(port, () => {
  console.log("running");
});

export default app;
