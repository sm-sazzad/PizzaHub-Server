# PizzaHub Server — Express REST API

<p align="center">
  <strong>The scalable backend REST API engine for PizzaHub, built with Express.js 5, Node.js (ESM), MongoDB Atlas, Better Auth JWT verification, and Stripe API.</strong>
</p>

<p align="center">
  <a href="https://pizzahub-server-iota.vercel.app/" target="_blank"><strong>⚡ Live Backend API</strong></a> •
  <a href="https://pizzahub-delta.vercel.app" target="_blank"><strong>🌐 Live Client Demo</strong></a> •
  <a href="https://github.com/sm-sazzad/PizzaHub-Server" target="_blank"><strong>🗄️ Server Repository</strong></a> •
  <a href="https://github.com/sm-sazzad/PizzaHub-Pizza-Ordering-Delivery-Platform" target="_blank"><strong>💻 Client Repository</strong></a>
</p>

---

## 🔗 Live Links & Repositories

- **Live Backend API Base URL:** [https://pizzahub-server-iota.vercel.app/](https://pizzahub-server-iota.vercel.app/)
- **Live Client Application:** [https://pizzahub-delta.vercel.app](https://pizzahub-delta.vercel.app)
- **Server GitHub Repository:** [PizzaHub-Server](https://github.com/sm-sazzad/PizzaHub-Server)
- **Client GitHub Repository:** [PizzaHub-Pizza-Ordering-Delivery-Platform](https://github.com/sm-sazzad/PizzaHub-Pizza-Ordering-Delivery-Platform)

---

## 💻 Tech Stack & Packages

- **Runtime:** Node.js (ES Modules)
- **Framework:** Express.js 5
- **Database:** MongoDB Atlas (Native `mongodb` driver v7)
- **Authentication Verification:** `jose` (using Remote JWKS via Better Auth)
- **Payment Processing:** `stripe` SDK
- **Cross-Origin & Config:** `cors`, `dotenv`
- **Deployment Platform:** Vercel Serverless Functions

---

## 🛠️ Local Setup

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/sm-sazzad/PizzaHub-Server.git
cd pizzahub-server
npm install
```

### 2. Environment Variables (`.env`)

Create a `.env` file in the root folder with:

```env
PORT=5000
MONGODB_URL=mongodb+srv://<username>:<password>@cluster.mongodb.net/PizzaHub?retryWrites=true&w=majority
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
BETTER_AUTH_URL=https://pizzahub-delta.vercel.app
```

- `PORT`: Port the server runs on (defaults to 5000).
- `MONGODB_URL`: Your MongoDB connection string.
- `STRIPE_SECRET_KEY`: Secret key from Stripe dashboard for checking checkout session payments.
- `BETTER_AUTH_URL`: Base URL of the client app where Better Auth exposes the `/api/auth/jwks` endpoint.

### 3. Run the Server

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
   - `verifyAdmin`: Checks that the user exists in the `user` collection, has `role === "admin"`, and `!isBlocked`.
   - `verifyVendor`: Checks that the user has `role === "vendor"`, and `!isBlocked`.
   - `verifyCustomer`: Checks that the user has `role === "customer"`, and `!isBlocked`.
   - `verifyCustomerOrVendor`: Allows active customers, vendors, or admins.
   - `verifyVendorOrAdmin`: Allows active vendors or admins.

---

## 📡 API Endpoints Reference

### Menu Items

| Method   | Route       | Auth / Role    | Description                                                                                        |
| :------- | :---------- | :------------- | :------------------------------------------------------------------------------------------------- |
| `GET`    | `/menu`     | Public         | Returns approved pizzas. Pass `?id=<id>` for one item, or `?vendorEmail=<email>` for vendor items. |
| `GET`    | `/features` | Public         | Returns top 6 approved pizzas for homepage featured section.                                       |
| `POST`   | `/menu`     | Vendor         | Creates a new pizza item with status `"approved"`.                                                 |
| `PATCH`  | `/menu/:id` | Vendor / Admin | Updates pizza item details or status.                                                              |
| `DELETE` | `/menu/:id` | Vendor         | Deletes a pizza item by ID.                                                                        |

### Orders

| Method  | Route                     | Auth / Role       | Description                                                                                     |
| :------ | :------------------------ | :---------------- | :---------------------------------------------------------------------------------------------- |
| `GET`   | `/orders`                 | Customer / Vendor | Returns orders where `customerEmail` or `vendorEmail` matches `?email=<email>`.                 |
| `POST`  | `/orders`                 | Customer          | Creates an order. Rejects duplicate active orders for the same item and delivery date with 409. |
| `PATCH` | `/orders/:id/status`      | Vendor            | Vendor updates status to `"accepted"` or `"rejected"`.                                          |
| `PATCH` | `/orders/:orderId/cancel` | Customer          | Customer cancels their own pending order (sets status to `"cancelled"`).                        |

### Reviews & Ratings (Assignment 9 Feature)

| Method | Route      | Auth / Role | Description                                                                                          |
| :----- | :--------- | :---------- | :--------------------------------------------------------------------------------------------------- |
| `GET`  | `/reviews` | Public      | Returns reviews for a pizza item via `?menuItemId=<id>`.                                             |
| `POST` | `/reviews` | Customer    | Submits or updates a 1–5 star review. Verifies that the customer has placed an order for this pizza. |

### Favorites

| Method   | Route              | Auth / Role   | Description                                               |
| :------- | :----------------- | :------------ | :-------------------------------------------------------- |
| `GET`    | `/favorites`       | Authenticated | Returns all favorited pizza items for the logged-in user. |
| `GET`    | `/favorites/check` | Authenticated | Checks if a pizza is favorited via `?menuId=<id>`.        |
| `POST`   | `/favorites`       | Authenticated | Adds a pizza item to the user's favorites list.           |
| `DELETE` | `/favorites`       | Authenticated | Removes a pizza from favorites via `?menuId=<id>`.        |

### Stripe Subscriptions

| Method  | Route            | Auth / Role | Description                                                                                                                 |
| :------ | :--------------- | :---------- | :-------------------------------------------------------------------------------------------------------------------------- |
| `PATCH` | `/premium-users` | Public      | Receives `sessionId`, confirms payment was successful with Stripe API, and sets vendor's `subscriptionPlan` to `"premium"`. |

### Admin Console

| Method   | Route                    | Auth / Role | Description                                                               |
| :------- | :----------------------- | :---------- | :------------------------------------------------------------------------ |
| `GET`    | `/admin/users`           | Admin       | Returns list of all registered users.                                     |
| `GET`    | `/admin/menu`            | Admin       | Returns all pizzas submitted by all vendors for approval/rejection.       |
| `DELETE` | `/admin/menu/:id`        | Admin       | Allows admin to remove any menu item from the system.                     |
| `GET`    | `/admin/transactions`    | Admin       | Returns users with premium plan as a ledger of subscription transactions. |
| `PATCH`  | `/admin/users/:id/role`  | Admin       | Changes a user's role (`customer`, `vendor`, `admin`).                    |
| `PATCH`  | `/admin/users/:id/block` | Admin       | Toggles `isBlocked` (true / false) for a user account.                    |

---

## 🗄️ Database Collections

- **`menu`:** Stores pizza recipes, prices, locations, categories, image arrays, and approval status (`pending`, `approved`, `rejected`).
- **`user`:** Stores user profiles, roles (`customer`, `vendor`, `admin`), block status (`isBlocked`), and subscription plan (`free`, `premium`).
- **`orders`:** Stores customer orders with delivery dates, addresses, contact numbers, notes, items, and status (`pending`, `accepted`, `rejected`, `cancelled`).
- **`reviews`:** Stores verified customer ratings (1 to 5), comments, timestamps, and customer info tied to a `menuItemId`.
- **`favorites`:** Stores customer bookmarked pizzas linked to user emails.

---

## 👤 Test Credentials for Evaluation

| Role         | Email              | Password       | Access & Capabilities                                                                                 |
| :----------- | :----------------- | :------------- | :---------------------------------------------------------------------------------------------------- |
| **Admin**    | `admin@gmail.com`  | `Admin123!`    | Full admin console access to manage users, toggle roles, block accounts, and oversee menu moderation. |
| **Vendor**   | `vendor@gmail.com` | `Vendor123!`   | Kitchen vendor portal to manage incoming orders and recipes.                                          |
| **Customer** | `shawon@gamil.com` | `Customer123!` | End-user account to place orders, write reviews, and test cancel features.                            |

---

## 👨‍💻 Author & Connect

- **Author:** Sheikh Md. Sazzad Hossain
- **LinkedIn:** [linkedin.com/in/sm-sazzad](https://linkedin.com/in/sm-sazzad/)
- **GitHub:** [@sm-sazzad](https://github.com/sm-sazzad)

---
