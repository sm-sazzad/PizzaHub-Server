# PizzaHub Server — Express REST API

This is the backend REST API for the PizzaHub web application. It handles database operations with MongoDB, authenticates requests using JWT tokens verified against Better Auth, manages order processing, and processes Stripe subscription payments for vendor upgrades.

---

## 💻 Tech Stack & Packages

* **Runtime:** Node.js (ES Modules)
* **Framework:** Express.js 5
* **Database:** MongoDB Atlas (Native `mongodb` driver v7)
* **JWT Verification:** `jose` (using Remote JWKS)
* **Payments:** `stripe` SDK
* **Utilities:** `cors`, `dotenv`

---

## 🛠️ Local Setup

### 1. Clone & install
```bash
git clone https://github.com/your-username/pizzahub-server.git
cd pizzahub-server
npm install
```

### 2. Environment Variables (`.env`)
Create a `.env` file in the root folder with:

```env
PORT=5000
MONGODB_URL=mongodb+srv://<username>:<password>@cluster.mongodb.net/PizzaHub?retryWrites=true&w=majority
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
BETTER_AUTH_URL=http://localhost:3000
```

* `PORT`: Port the server runs on (defaults to 5000).
* `MONGODB_URL`: Your MongoDB connection string.
* `STRIPE_SECRET_KEY`: Secret key from Stripe dashboard for checking checkout session payments.
* `BETTER_AUTH_URL`: Base URL of the client app where Better Auth exposes the `/api/auth/jwks` endpoint.

### 3. Run the server
```bash
# Start server
node index.js

# Or start with auto-reload (Node 18+)
node --watch index.js
```
The server will start on `http://localhost:5000`.

---

## 🔒 Authentication & Role Middlewares

Incoming requests to private routes pass through two middleware checks:

1. **`verifyToken`:** Reads the `Authorization: Bearer <token>` header, then uses `jwtVerify` from `jose` with `createRemoteJWKSet` pointing to `${BETTER_AUTH_URL}/api/auth/jwks` to verify the signature. Attaches the decoded user payload to `req.user`.
2. **Role Middlewares:**
   * `verifyAdmin`: Checks that the user exists in the `user` collection, has `role === "admin"`, and `!isBlocked`.
   * `verifyVendor`: Checks that the user has `role === "vendor"`, and `!isBlocked`.
   * `verifyCustomer`: Checks that the user has `role === "customer"`, and `!isBlocked`.
   * `verifyCustomerOrVendor`: Allows active customers, vendors, or admins.

---

## 📡 API Endpoints Reference

### Menu Items
| Method | Route | Auth / Role | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/menu` | Public | Returns approved pizzas. Pass `?id=<id>` for one item, or `?vendorEmail=<email>` for vendor items. |
| `GET` | `/features` | Public | Returns top 6 approved pizzas for homepage featured section. |
| `POST` | `/menu` | Vendor | Creates a new pizza item with status `"pending"`. |
| `PATCH` | `/menu/:id` | Vendor / Admin | Updates pizza item details or status. |
| `DELETE` | `/menu/:id` | Vendor | Deletes a pizza item by ID. |

### Orders
| Method | Route | Auth / Role | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/orders` | Customer / Vendor | Returns orders where `customerEmail` or `vendorEmail` matches `?email=<email>`. |
| `POST` | `/orders` | Customer | Creates an order. Rejects duplicate active orders for the same item and delivery date with 409. |
| `PATCH` | `/orders/:id/status` | Vendor | Vendor updates status to `"accepted"` or `"rejected"`. |
| `PATCH` | `/orders/:orderId/cancel` | Customer | Customer cancels their own pending order (sets status to `"cancelled"`). |

### Reviews & Ratings (Optional Requirement #1)
| Method | Route | Auth / Role | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/reviews` | Public | Returns reviews for a pizza item via `?menuItemId=<id>`. |
| `POST` | `/reviews` | Customer | Submits or updates a 1–5 star review. Verifies that the customer has placed an order for this pizza. |

### Stripe Subscriptions
| Method | Route | Auth / Role | Description |
| :--- | :--- | :--- | :--- |
| `PATCH` | `/premium-users` | Public | Receives `sessionId`, confirms payment was successful with Stripe API, and sets vendor's `subscriptionPlan` to `"premium"`. |

### Admin Console
| Method | Route | Auth / Role | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/admin/users` | Admin | Returns list of all registered users. |
| `GET` | `/admin/menu` | Admin | Returns all pizzas submitted by all vendors for approval/rejection. |
| `GET` | `/admin/transactions` | Admin | Returns users with premium plan as a ledger of subscription transactions. |
| `PATCH` | `/admin/users/:id/role` | Admin | Changes a user's role (`customer`, `vendor`, `admin`). |
| `PATCH` | `/admin/users/:id/block` | Admin | Toggles `isBlocked` (true / false) for a user account. |

---

## 🗄️ Database Collections

* **`menu`:** Stores pizza recipes, prices, locations, categories, image arrays, and approval status (`pending`, `approved`, `rejected`).
* **`user`:** Stores user profiles, roles (`customer`, `vendor`, `admin`), block status (`isBlocked`), and subscription plan (`free`, `premium`).
* **`orders`:** Stores customer orders with delivery dates, addresses, contact numbers, notes, items, and status (`pending`, `accepted`, `rejected`, `cancelled`).
* **`reviews`:** Stores verified customer ratings (1 to 5), comments, timestamps, and customer info tied to a `menuItemId`.
