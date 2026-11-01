
import express from "express";
import { MongoClient, ObjectId  } from "mongodb";
import cors from "cors";
import "dotenv/config";
import { createRemoteJWKSet, jwtVerify } from "jose";

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(cors());
app.use(express.json());

// JWT Middleware


const authURL = process.env.CLIENT_URL;

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
const categoriesCollection = db.collection("categories");
const eventsCollection = db.collection("events");
const joinedEventsCollection = db.collection("joinedEvents");



// Home Route
app.get("/", (req, res) => {
  res.send({ message: "KindnessMeet Server is running!" });
});

// Get Categories API ####################
app.get("/api/categories", async (req, res) => {
  try {
    const categories = await categoriesCollection
      .find()
      .sort({ name: 1 })
      .toArray();

    res.send(categories);
  } catch (error) {
    res.status(500).send({
      message: "Failed to fetch categories!",
    });
  }
});


// Create a new Event ####################

app.post("/api/events", verifyToken, async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      location,
      eventDate,
      imageUrl,
    } = req.body;

    const newEvent = {
      title,
      description,
      category,
      location,
      eventDate: new Date(eventDate),
      imageUrl,
      creatorId: req.user.sub,
      creatorName: req.user.name,
      creatorEmail: req.user.email,
      createdAt: new Date(),
    };

    const result = await eventsCollection.insertOne(newEvent);

    res.status(201).send({
      message: "Event created successfully!",
      insertedId: result.insertedId,
    });
  } catch (error) {
    console.error("Create event error:", error);

    res.status(500).send({
      message: "Failed to create event!",
    });
  }
});


// Get Upcomming Events ##############

app.get("/api/events", async (req, res) => {
  try {
    const events = await eventsCollection
      .find({
        eventDate: { $gt: new Date() },
      })
      .sort({ eventDate: 1 })
      .toArray();

    res.send(events);
  } catch (error) {
    res.status(500).send({
      message: "Failed to fetch upcoming events!",
    });
  }
});

// Get single event #################


app.get("/api/events/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid event ID!" });
    }

    const event = await eventsCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!event) {
      return res.status(404).send({
        message: "Event not found!",
      });
    }

    res.send(event);
  } catch (error) {
    res.status(500).send({
      message: "Failed to fetch event!",
    });
  }
});

// Get joined volunteers ###############

app.get("/api/events/:id/volunteers", async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid event ID!" });
    }

    const volunteers = await joinedEventsCollection
      .find({ eventId: new ObjectId(id) })
      .project({
        _id: 0,
        userId: 1,
        userName: 1,
        userImage: 1,
      })
      .toArray();

    res.send(volunteers);
  } catch (error) {
    res.status(500).send({
      message: "Failed to fetch volunteers!",
    });
  }
});

// await joinedEventsCollection.createIndex(
//   { eventId: 1, userId: 1 },
//   { unique: true }
// );

// Join Event API ################


app.post("/api/events/:id/join", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({
        message: "Invalid event ID!",
      });
    }

    const eventId = new ObjectId(id);

    const event = await eventsCollection.findOne({
      _id: eventId,
    });

    if (!event) {
      return res.status(404).send({
        message: "Event not found!",
      });
    }

    // Organizer cannot join their own event
    if (event.creatorId === req.user.sub) {
      return res.status(403).send({
        message: "You cannot join your own event!",
      });
    }

    // Event must be upcoming
    if (
      !Number.isFinite(new Date(event.eventDate).getTime()) ||
      new Date(event.eventDate) <= new Date()
    ) {
      return res.status(400).send({
        message: "This event is no longer available!",
      });
    }

    const volunteer = {
      eventId,
      userId: req.user.sub,
      userName: req.user.name || "Volunteer",
      userEmail: req.user.email,
      userImage: req.user.image || null,
      joinedAt: new Date(),
    };

    await joinedEventsCollection.insertOne(volunteer);

    res.status(201).send({
      message: "Successfully joined the event!",
      volunteer: {
        userId: volunteer.userId,
        userName: volunteer.userName,
        userImage: volunteer.userImage,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).send({
        message: "You have already joined this event!",
      });
    }

    console.error("Join event error:", error);

    res.status(500).send({
      message: "Failed to join event!",
    });
  }
});

// GET — Logged-in user's events ##############

app.get("/api/my-events", verifyToken, async (req, res) => {
  try {
    const events = await eventsCollection
      .find({ creatorId: req.user.sub })
      .sort({ createdAt: -1 })
      .toArray();

    res.send(events);
  } catch (error) {
    res.status(500).send({
      message: "Failed to fetch your events!",
    });
  }
});

//  Update event ##########

app.patch("/api/events/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid event ID!" });
    }

    const { title, description, category, location, eventDate, imageUrl } =
      req.body;

    const date = new Date(eventDate);

    if (Number.isNaN(date.getTime()) || date <= new Date()) {
      return res.status(400).send({
        message: "Event date must be in the future!",
      });
    }

    const result = await eventsCollection.updateOne(
      {
        _id: new ObjectId(id),
        creatorId: req.user.sub,
      },
      {
        $set: {
          title,
          description,
          category,
          location,
          eventDate: date,
          imageUrl,
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).send({
        message: "Event not found or access denied!",
      });
    }

    res.send({ message: "Event updated successfully!" });
  } catch (error) {
    res.status(500).send({
      message: "Failed to update event!",
    });
  }
});

//  Delete event ##############

app.delete("/api/events/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid event ID!" });
    }

    const eventId = new ObjectId(id);

    const result = await eventsCollection.deleteOne({
      _id: eventId,
      creatorId: req.user.sub,
    });

    if (result.deletedCount === 0) {
      return res.status(404).send({
        message: "Event not found or access denied!",
      });
    }

    // Remove volunteers associated with the deleted event
    await joinedEventsCollection.deleteMany({ eventId });

    res.send({ message: "Event deleted successfully!" });
  } catch (error) {
    res.status(500).send({
      message: "Failed to delete event!",
    });
  }
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
