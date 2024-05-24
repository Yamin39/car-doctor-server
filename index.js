const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;

// middlewares
app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// custom middlewares
const logger = async (req, res, next) => {
  console.log("called:", req.host, req.originalUrl);
  next();
};

const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token;
  console.log("token inside verifyToken middleware: ", token);
  if (!token) {
    return res.status(401).send({ message: "Unauthorized" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    // error
    if (err) {
      console.log(err);
      return res.status(401).send({ message: "Unauthorized" });
    }
    // if token is valid then it would be decoded
    console.log("value of decoded", decoded);
    req.user = decoded;
    next();
  });
};

const uri = "mongodb://localhost:27017";

// const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.6fu63x8.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const servicesCollection = client.db("carDoctor").collection("services");
    const bookingsCollection = client.db("carDoctor").collection("bookings");

    // auth
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      // console.log(user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "1s" });
      res
        .cookie("token", token, {
          httpOnly: true,
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
          secure: process.env.NODE_ENV === "production" ? true : false,
        })
        .send({ success: true });
    });

    app.post("/logout", async (req, res) => {
      const user = req.body;
      console.log(`logging out: ${user}`);
      res.clearCookie("token", { maxAge: 0 }).send({ success: true });
    });

    // services
    app.get("/services", logger, async (req, res) => {
      const result = await servicesCollection.find().toArray();
      res.send(result);
    });

    app.get("/services/:id", async (req, res) => {
      const query = { _id: new ObjectId(req.params.id) };
      const options = {
        projection: { title: 1, price: 1, service_id: 1, img: 1 },
      };
      const result = await servicesCollection.findOne(query, options);
      res.send(result);
    });

    // bookings
    app.post("/bookings", async (req, res) => {
      const result = await bookingsCollection.insertOne(req.body);
      res.send(result);
    });

    app.get("/bookings", logger, verifyToken, async (req, res) => {
      // console.log("token", req.cookies.token);
      console.log("user in the valid token:", req.user);
      if (req.query.email !== req.user.email) {
        return res.status(403).send({ message: "Forbidden access" });
      }
      const email = req?.query?.email;
      let query = {};
      if (email) {
        query = { email: email };
      }
      const result = await bookingsCollection.find(query).toArray();
      res.send(result);
    });

    app.patch("/bookings/:id", async (req, res) => {
      const filter = { _id: new ObjectId(req.params.id) };
      const updatedDoc = {
        $set: {
          status: req.body.status,
        },
      };
      const result = await bookingsCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    app.delete("/bookings/:id", async (req, res) => {
      const result = await bookingsCollection.deleteOne({ _id: new ObjectId(req.params.id) });
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Car Doctor Server is running");
});

app.listen(port, () => {
  console.log(`Car Doctor Server is running on port: ${port}`);
});
