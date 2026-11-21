import express from "express";
import cors from "cors";
import "dotenv/config";
import { MongoClient, ObjectId } from "mongodb";
import Stripe from "stripe";
import { createRemoteJWKSet, jwtVerify } from "jose";

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
const user = database.collection("user");
const orders = database.collection("orders");
const reviews = database.collection("reviews");
const favorites = database.collection("favorites");

// token verify
const authBaseUrl = process.env.BETTER_AUTH_URL || "http://localhost:3000";
const jwks = createRemoteJWKSet(new URL(`${authBaseUrl}/api/auth/jwks`));

const verifyToken = async (req, res, next) => {
  const authToken = req.headers.authorization;
  if (!authToken) {
    return res.status(401).send({
      message: "Unauthorized",
    });
  }
  const [scheme, token] = authToken.split(" ");
  if (scheme !== "Bearer" || !token) {
    return res.status(401).send({
      message: "Unauthorized",
    });
  }

  try {
    const { payload } = await jwtVerify(token, jwks);
    req.user = payload;
    next();
  } catch (error) {
    return res.status(401).send({
      message: "Unauthorized",
    });
  }
};

// role verify
// admin verification
const verifyAdmin = async (req, res, next) => {
  const email = req.user?.email;
  const dbUser = await user.findOne({ email });

  if (!dbUser || dbUser.role !== "admin" || dbUser.isBlocked) {
    return res.status(403).send({ message: "Forbidden: Admin access only" });
  }

  next();
};

// vendor verification
const verifyVendor = async (req, res, next) => {
  const email = req.user?.email;
  const dbUser = await user.findOne({ email });

  if (!dbUser || dbUser.role !== "vendor" || dbUser.isBlocked) {
    return res.status(403).send({ message: "Forbidden: Vendor access only" });
  }

  next();
};

// customer verification
const verifyCustomer = async (req, res, next) => {
  const email = req.user?.email;
  const dbUser = await user.findOne({ email });

  if (!dbUser || dbUser.role !== "customer" || dbUser.isBlocked) {
    return res.status(403).send({ message: "Forbidden: Customer access only" });
  }

  next();
};

// vendor or admin verification
const verifyVendorOrAdmin = async (req, res, next) => {
  const email = req.user?.email;
  const dbUser = await user.findOne({ email });

  if (
    !dbUser ||
    (dbUser.role !== "vendor" && dbUser.role !== "admin") ||
    dbUser.isBlocked
  ) {
    return res
      .status(403)
      .send({ message: "Forbidden: Vendor or Admin access only" });
  }

  next();
};

// customer, vendor, or admin verification (valid active user)
const verifyCustomerOrVendor = async (req, res, next) => {
  const email = req.user?.email;
  const dbUser = await user.findOne({ email });

  if (
    !dbUser ||
    (dbUser.role !== "customer" &&
      dbUser.role !== "vendor" &&
      dbUser.role !== "admin") ||
    dbUser.isBlocked
  ) {
    return res
      .status(403)
      .send({ message: "Forbidden: Account suspended or access restricted" });
  }

  next();
};

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

app.get("/orders", verifyToken, verifyCustomerOrVendor, async (req, res) => {
  const email = req.query.email;
  const query = { $or: [{ vendorEmail: email }, { customerEmail: email }] };
  const result = await orders.find(query).toArray();
  res.send(result);
});

app.post("/orders", verifyToken, verifyCustomer, async (req, res) => {
  const newOrder = req.body;

  // Check if customer account is blocked
  const customerUser = await user.findOne({ email: newOrder.customerEmail });
  if (!customerUser || customerUser.isBlocked) {
    return res.status(403).send({
      message:
        "Your account is suspended or not found. You cannot place orders.",
    });
  }

  // Check for duplicate active order: same user, same item, same delivery date
  const duplicateQuery = {
    customerEmail: newOrder.customerEmail,
    menuItemId: newOrder.menuItemId,
    deliveryDate: newOrder.deliveryDate,
    status: { $in: ["pending", "accepted"] },
  };

  const existingOrder = await orders.findOne(duplicateQuery);

  if (existingOrder) {
    return res.status(409).send({
      message:
        "You already have an active order for this pizza on the selected delivery date.",
    });
  }

  const result = await orders.insertOne(newOrder);
  res.send(result);
});

app.patch("/orders/:id/status", verifyToken, verifyVendor, async (req, res) => {
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

app.patch(
  "/orders/:orderId/cancel",
  verifyToken,
  verifyCustomer,
  async (req, res) => {
    const orderId = req.params.orderId;
    const query = { _id: new ObjectId(orderId) };
    const updatedDoc = {
      $set: {
        status: "cancelled",
      },
    };
    const result = await orders.updateOne(query, updatedDoc);
    res.send(result);
  },
);

// Reviews & Ratings endpoints (Assignment 9 Optional Requirement #1)
app.get("/reviews", async (req, res) => {
  const { menuItemId } = req.query;
  const query = menuItemId ? { menuItemId } : {};
  const result = await reviews.find(query).sort({ createdAt: -1 }).toArray();
  res.send(result);
});

app.post("/reviews", verifyToken, verifyCustomer, async (req, res) => {
  const { menuItemId, rating, comment, customerName, customerImage } = req.body;
  const customerEmail = req.user?.email;

  if (!menuItemId || !rating || !comment?.trim()) {
    return res
      .status(400)
      .send({ message: "Rating and review message are required." });
  }

  // Check if customer account is suspended
  const customerUser = await user.findOne({ email: customerEmail });
  if (!customerUser || customerUser.isBlocked) {
    return res
      .status(403)
      .send({ message: "Your account is suspended or not found." });
  }

  // Requirement: Only customers who ordered this pizza can leave a review
  const hasOrdered = await orders.findOne({
    customerEmail,
    $or: [{ menuItemId }, { itemId: menuItemId }],
  });

  if (!hasOrdered) {
    return res.status(403).send({
      message: "You can only rate and review pizzas you have ordered.",
    });
  }

  const reviewDoc = {
    menuItemId,
    customerEmail,
    customerName: customerName || customerUser?.name || "Customer",
    customerImage: customerImage || customerUser?.image || "",
    rating: Number(rating),
    comment: comment.trim(),
    createdAt: new Date().toISOString(),
  };

  // Upsert: user can submit a review or update their existing review
  const filter = { customerEmail, menuItemId };
  const updateDoc = { $set: reviewDoc };
  const result = await reviews.updateOne(filter, updateDoc, { upsert: true });

  res.send(result);
});

app.patch("/menu/:id", verifyToken, verifyVendorOrAdmin, async (req, res) => {
  const { id } = req.params;
  const updatedData = { ...req.body };
  delete updatedData._id; // _id immutable tai delete kora hoyeche

  const query = { _id: new ObjectId(id) };
  const updateDoc = {
    $set: updatedData,
  };

  const result = await menu.updateOne(query, updateDoc);
  res.send(result);
});

app.delete("/menu/:id", verifyToken, verifyVendor, async (req, res) => {
  const { id } = req.params;
  const query = { _id: new ObjectId(id) };
  const result = await menu.deleteOne(query);
  res.send(result);
});

app.post("/menu", verifyToken, verifyVendor, async (req, res) => {
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
    const result = await user.updateOne(filter, updateDoc);
    console.log(result);
    res.send(result);
    return;
  }
  return res.status(400).send({ message: "Payment not completed" });
});

// admin access
app.get("/admin/users", verifyToken, verifyAdmin, async (req, res) => {
  const result = await user.find().toArray();
  res.send(result);
});

app.get("/admin/menu", verifyToken, verifyAdmin, async (req, res) => {
  const result = await menu.find().toArray();
  res.send(result);
});

app.delete("/admin/menu/:id", verifyToken, verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const query = { _id: new ObjectId(id) };
  const result = await menu.deleteOne(query);
  res.send(result);
});

app.get("/admin/transactions", verifyToken, verifyAdmin, async (req, res) => {
  const result = await user.find({ subscriptionPlan: "premium" }).toArray();
  res.send(result);
});

app.patch(
  "/admin/users/:id/role",
  verifyToken,
  verifyAdmin,
  async (req, res) => {
    const { id } = req.params;
    const query = { _id: new ObjectId(id) };
    const newRole = req.body;
    const updatedDoc = {
      $set: {
        role: newRole.role,
      },
    };
    const result = await user.updateOne(query, updatedDoc);
    res.send(result);
    console.log(result);
  },
);

app.patch(
  "/admin/users/:id/block",
  verifyToken,
  verifyAdmin,
  async (req, res) => {
    const { id } = req.params;
    const updateBlock = req.body;
    const query = { _id: new ObjectId(id) };
    const updatedDoc = {
      $set: {
        isBlocked: updateBlock.isBlocked,
      },
    };
    const result = await user.updateOne(query, updatedDoc);
    res.send(result);
    console.log(result);
  },
);

// Favorites endpoints
app.get("/favorites/check", verifyToken, async (req, res) => {
  const email = req.user?.email;
  const { menuId } = req.query;
  if (!email || !menuId) {
    return res.send({ isFavorite: false });
  }
  const found = await favorites.findOne({ userEmail: email, menuId });
  res.send({ isFavorite: !!found });
});

app.post("/favorites", verifyToken, async (req, res) => {
  const email = req.user?.email;
  const { menuId, itemName, image, price, category } = req.body;
  if (!menuId) {
    return res.status(400).send({ message: "menuId is required" });
  }
  const existing = await favorites.findOne({ userEmail: email, menuId });
  if (existing) {
    return res.send({ message: "Already in favorites", insertedId: existing._id });
  }
  const result = await favorites.insertOne({
    userEmail: email,
    menuId,
    itemName,
    image,
    price,
    category,
    createdAt: new Date(),
  });
  res.send(result);
});

app.delete("/favorites", verifyToken, async (req, res) => {
  const email = req.user?.email;
  const { menuId } = req.query;
  if (!menuId) {
    return res.status(400).send({ message: "menuId is required" });
  }
  const result = await favorites.deleteOne({ userEmail: email, menuId });
  res.send(result);
});

app.get("/favorites", verifyToken, async (req, res) => {
  const email = req.user?.email;
  const result = await favorites.find({ userEmail: email }).sort({ createdAt: -1 }).toArray();
  res.send(result);
});

app.listen(port, () => {
  console.log("running");
});

export default app;
