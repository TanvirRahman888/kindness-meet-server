
<div align="center">

# 🤝 KindnessMeet — Backend API

**A REST API for discovering, creating, managing, and joining community volunteering events.**

Built with **Node.js**, **Express.js**, **MongoDB**, and **JWT verification via Better Auth + JOSE**.

[Frontend Repository](https://github.com/TanvirRahman888/kindness-meet-client) · [Backend Repository](https://github.com/TanvirRahman888/kindness-meet-server) · [Live Website](https://kindness-meet.vercel.app)

</div>

---

## 📖 Overview

KindnessMeet connects volunteers with community service opportunities. This backend provides event discovery, volunteer participation, and organizer-owned event management through REST endpoints.

Authentication is handled by **Better Auth in the Next.js frontend**. The backend verifies signed JWTs using the frontend's public JSON Web Key Set (JWKS), then uses the verified user ID for protected operations.

## ✨ Features

- **Upcoming events:** Retrieve future events sorted by event date.
- **Event details:** Fetch a single event by its MongoDB ID.
- **Categories:** Browse event categories alphabetically.
- **Volunteer participation:** Join eligible events and view joined volunteers.
- **My events:** Retrieve, update, and delete events created by the authenticated user.
- **My joined events:** View events the current user has joined and leave an event.
- **JWT-protected endpoints:** Verify token signatures, issuer, audience, expiration, and user identity.
- **Ownership checks:** Prevent organizers from editing or deleting other users' events.

## 🛠️ Tech Stack

| Technology | Purpose |
| --- | --- |
| Node.js + ES modules | JavaScript runtime |
| Express 5 | HTTP server and REST API |
| MongoDB Node.js Driver | Database operations |
| JOSE | JWT signature and claim verification |
| Better Auth (frontend) | Session management and JWT issuing |
| CORS | Cross-origin request support |
| dotenv | Load local environment variables |

## 📁 Project Structure

```text
kindness-meet-server/
├── index.js          # Express app, authentication middleware, and API routes
├── package.json      # Dependencies and npm scripts
├── package-lock.json # Dependency lockfile (when present)
├── .gitignore
├── .env               # Local secrets (do not commit)
└── README.md
```

## 🚀 Getting Started

### 1. Prerequisites

- Node.js and npm (a current Node.js LTS release is recommended)
- A MongoDB database (local or MongoDB Atlas)
- The [KindnessMeet client](https://github.com/TanvirRahman888/kindness-meet-client) configured with Better Auth and its JWT plugin

### 2. Clone and install

```bash
git clone https://github.com/TanvirRahman888/kindness-meet-server.git
cd kindness-meet-server
npm install
```

### 3. Configure environment variables

Create a `.env` file at the repository root:

```dotenv
PORT=8000
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster-host>/
CLIENT_URL=http://localhost:3000
```

| Variable | Required | Description |
| --- | --- | --- |
| `MONGODB_URI` | Yes | MongoDB connection string |
| `CLIENT_URL` | Yes | Exact origin of the Next.js app that issues JWTs; also used to fetch `/api/auth/jwks` |
| `PORT` | No | Local HTTP port; defaults to `8000` |

> **Security:** Never commit `.env`, database credentials, OAuth secrets, or JWTs. Set production values in your hosting provider's environment settings. `CLIENT_URL` should be an origin with no trailing slash (for example, `https://kindness-meet.vercel.app`).

### 4. Start the server

```bash
npm start
```

The API will be available at:

```text
http://localhost:8000
```

The repository also defines `npm run dev`, which uses **nodemon**. If nodemon is not already installed, install it as a development dependency first:

```bash
npm install --save-dev nodemon
npm run dev
```

### 5. Check the API

```bash
curl http://localhost:8000/
curl http://localhost:8000/api/categories
curl http://localhost:8000/api/events
```

## 🔐 Authentication and Authorization

KindnessMeet uses **two separate services**:

1. **Next.js + Better Auth** signs users in and issues JWTs. The frontend exposes `/api/auth/token` and `/api/auth/jwks` through the Better Auth JWT plugin.
2. **Express + JOSE** verifies the JWT received in an `Authorization: Bearer <token>` header against the frontend's JWKS endpoint.
3. Once verified, the token payload is assigned to `req.user`, and protected routes use `req.user.sub` as the authenticated user's ID.

```text
User signs in → Better Auth session
              → JWT issued by Next.js
              → Authorization: Bearer <JWT>
              → Express verifyToken middleware
              → MongoDB operation authorized for req.user.sub
```

The middleware verifies the JWT **signature, issuer, audience, and expiration**, and rejects missing/invalid tokens with HTTP `401`. Event update/delete operations also check that the verified user is the event creator.

**Note:** JWTs are issued by the **frontend's Better Auth service**, not by this Express server. Keep `CLIENT_URL` in the backend consistent with the frontend's Better Auth base URL and issuer/audience settings.

## 📡 API Reference

**Base URL (local):** `http://localhost:8000`

### Public endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/` | Server health/message |
| `GET` | `/api/categories` | List categories alphabetically |
| `GET` | `/api/events` | List future events, sorted by nearest event date |
| `GET` | `/api/events/:id` | Get an event by ID |
| `GET` | `/api/events/:id/volunteers` | List volunteer names, IDs, and images for an event |

### Protected endpoints (Bearer JWT required)

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/api/events` | Create an event for the authenticated user |
| `POST` | `/api/events/:id/join` | Join an upcoming event as a volunteer |
| `GET` | `/api/my-events` | List events created by the current user |
| `PATCH` | `/api/events/:id` | Update an event owned by the current user |
| `DELETE` | `/api/events/:id` | Delete an owned event and its associated join records |
| `GET` | `/api/my-joined-events` | List events the current user joined |
| `DELETE` | `/api/my-joined-events/:id` | Leave the specified event (`:id` is the **event ID**) |
| `GET` | `/api/protected` | Test JWT authentication; returns the verified user ID |

### Example: Get upcoming events

```http
GET /api/events
```

This endpoint currently returns **all future events**, sorted by `eventDate` ascending. The currently committed backend does **not** implement a `?limit=6` query parameter.

### Example: Create an event

```http
POST /api/events
Authorization: Bearer YOUR_JWT
Content-Type: application/json
```

```json
{
  "title": "Community Cleanup Drive",
  "description": "Join volunteers to clean our neighborhood park.",
  "category": "Community Cleanup",
  "location": "Dhaka, Bangladesh",
  "eventDate": "2026-12-15T10:00:00.000Z",
  "imageUrl": "https://example.com/event.jpg"
}
```

**Success:** `201 Created` with a message and `insertedId`.

The server adds `creatorId`, `creatorName`, `creatorEmail`, and `createdAt` using the verified JWT payload instead of trusting these values from the request body.

### Example: Join an event

```http
POST /api/events/REPLACE_WITH_EVENT_ID/join
Authorization: Bearer YOUR_JWT
```

The server checks that the event exists, is still upcoming, and was not created by the requesting user. On success, it saves a volunteer record and responds with **`201 Created`**.

### Example: Leave an event

```http
DELETE /api/my-joined-events/REPLACE_WITH_EVENT_ID
Authorization: Bearer YOUR_JWT
```

Only the join record matching **both** the event ID and verified user ID can be deleted.

## 🗃️ MongoDB Collections

The application uses the `KindnessMeet` database and three collections:

| Collection | Stores |
| --- | --- |
| `categories` | Event category documents |
| `events` | Event information, creator metadata, and dates |
| `joinedEvents` | Volunteer joins, event/user IDs, and join timestamps |

**`events` example (simplified):**

```json
{
  "title": "Community Cleanup Drive",
  "category": "Community Cleanup",
  "location": "Dhaka, Bangladesh",
  "creatorId": "user-id-from-jwt",
  "eventDate": "2026-12-15T10:00:00.000Z"
}
```

**`joinedEvents` example (simplified):**

```json
{
  "eventId": "mongo-object-id",
  "userId": "user-id-from-jwt",
  "userName": "Volunteer Name",
  "joinedAt": "2026-11-03T10:00:00.000Z"
}
```

MongoDB stores `eventId`, `_id`, and date fields using their appropriate BSON types; the JSON above is for illustration.

## ☁️ Deployment (Vercel)

Deploy the server as a **separate Vercel project** from the Next.js frontend.

1. Import the [backend repository](https://github.com/TanvirRahman888/kindness-meet-server).
2. Configure it as an Express/Node.js application following the current [Vercel Express documentation](https://vercel.com/docs/frameworks/backend/express).
3. Add production environment variables in Vercel Project Settings:

   ```dotenv
   MONGODB_URI=YOUR_PRODUCTION_MONGODB_URI
   CLIENT_URL=https://kindness-meet.vercel.app
   ```

4. Deploy, then test `/`, `/api/categories`, and `/api/events` on the deployed URL.
5. Set the frontend's `NEXT_PUBLIC_API_URL` / server-side `API_URL` to the deployed backend origin, and redeploy the frontend if necessary.

An optional `vercel.json` configuration may be appropriate depending on the project's Vercel settings and current platform support. There is no `vercel.json` committed in this repository at the time this README was prepared.

> **Production note:** The server currently uses `app.use(cors())`, which permits cross-origin requests broadly. Consider restricting CORS to known frontend origins when hardening the API.

## ⚠️ Current Implementation Notes

The following items describe the **current committed backend**, not completed enhancements:

- **Duplicate joins:** The code handles MongoDB duplicate-key errors, but does not currently create a unique `{ eventId, userId }` index. A database unique index is recommended to reliably prevent multiple joins by the same user.
- **Joined events ordering:** `GET /api/my-joined-events` currently retrieves join records sorted by `joinedAt` descending, **not** by `eventDate`.
- **Create-event validation:** The create endpoint currently accepts request fields without the same server-side future-date validation used by the update endpoint. Add request validation before production use.
- **Homepage limit:** `GET /api/events` currently has no built-in MongoDB `.limit(6)` support.

## 🔗 Related Links

- **Frontend:** https://github.com/TanvirRahman888/kindness-meet-client
- **Backend:** https://github.com/TanvirRahman888/kindness-meet-server
- **Website:** https://kindness-meet.vercel.app
- **Express:** https://expressjs.com/
- **MongoDB:** https://www.mongodb.com/docs/drivers/node/current/
- **Better Auth:** https://www.better-auth.com/
- **JOSE:** https://github.com/panva/jose

---

<div align="center">

Made for communities that care. ❤️

</div>
