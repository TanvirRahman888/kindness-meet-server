
import express from "express";
import { MongoClient } from "mongodb";
import cors from "cors";
import "dotenv/config";
import { createRemoteJWKSet, jwtVerify } from "jose";

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(cors());
app.use(express.json());

// JWT Middleware


const authURL = process.env.CLIENT_URL || "http://localhost:3000";

const JWKS = createRemoteJWKSet(
  new URL(`${authURL}/api/auth/jwks`)
);

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).send({
      message: "Unauthorized! Token missing.",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: authURL,
      audience: authURL,
    });

    if (!payload.sub) {
      return res.status(401).send({
        message: "Invalid token.",
      });
    }

    req.user = payload;
    next();
  } catch (error) {
    return res.status(401).send({
      message: "Invalid or expired token.",
    });
  }
};


// MongoDB Connection
const client = new MongoClient(process.env.MONGODB_URI);

async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("Successfully connected to MongoDB!");
    return client;
  } catch (error) {
    console.error("MongoDB connection failed:", error);
    process.exit(1);
  }
}

const mongoClient = await connectToMongoDB();
const db = mongoClient.db("KindnessMeet");

// Collections
const eventsCollection = db.collection("events");
const joinedEventsCollection = db.collection("joinedEvents");



// Home Route
app.get("/", (req, res) => {
  res.send({ message: "KindnessMeet Server is running!" });
});


app.get("/api/protected", verifyToken, (req, res) => {
  res.send({
    message: "You are authenticated!",
    userId: req.user.sub,
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

export default app;
