require("dotenv").config();
const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId, Long } = require("mongodb");
const app = express();
const cors = require("cors");
const port = process.env.PORT || 5006;

app.use(
  cors({
    origin: ["http://localhost:5173", "https://cardoctor-bd.web.app"],
  })
);
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.kvwwfig.mongodb.net/?retryWrites=true&w=majority`;

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

    //to use into vercel this code should not be used
    // await client.connect();

    const db = client.db("touristGuideDB");
    const userCollection = db.collection("users");
    const packageCollection = db.collection("packages");
    const bookingCollection = db.collection("bookings");
    const wishListCollection = db.collection("wishlists");
    const guideReviewCollection = db.collection("guide_reviews");

    /**--------------------------------->
     * Auth Related API******************>
     * --------------------------------->
     */

    // getting users
    app.get("/users", async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    // getting single users info with email

    app.get("/user/:email", async (req, res) => {
      const email = req.params.email;
      const result = await userCollection.findOne({ email });
      res.send(result);
    });

    //   creating users

    app.post("/users", async (req, res) => {
      const user = req.body;
      const { email } = user;
      const userExist = await userCollection.findOne({ email });
      if (userExist) {
        return;
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    // getting packages

    app.get("/packages", async (req, res) => {
      const result = await packageCollection.find().toArray();
      res.send(result);
    });

    // get single package by id

    app.get("/package/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await packageCollection.findOne(query);
      res.send(result);
    });

    // creating packages

    app.post("/packages", async (req, res) => {
      const package = req.body;
      const result = await packageCollection.insertOne(package);
      res.send(result);
    });

    // updating user api

    app.put("/updateuser", async (req, res) => {
      const { id, role, status } = req.query;

      const filter = { _id: new ObjectId(id) };
      const updatedUser = {
        $set: {
          role,
          status: status || "accepted",
        },
      };
      const options = { upsert: true };
      const result = await userCollection.updateOne(
        filter,
        updatedUser,
        options
      );
      res.send(result);
    });

    // getting all guides api

    app.get("/guides", async (req, res) => {
      const query = { role: "guide" };
      const result = await userCollection.find(query).toArray();
      res.send(result);
    });

    // get single guides with email

    app.get("/guides/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id), role: "guide" };
      const result = await userCollection.findOne(query);
      res.send(result);
    });

    // updating guide profile
    app.put("/users", async (req, res) => {
      const guideInfo = req.body;
      const { email } = guideInfo;
      const filter = { email };
      const updatedUser = {
        $set: {
          ...guideInfo,
        },
      };
      const options = { upsert: true };
      const result = await userCollection.updateOne(
        filter,
        updatedUser,
        options
      );
      res.send(result);
    });

    // get all bookings
    app.get("/bookings", async (req, res) => {
      const result = await bookingCollection.find().toArray();
      res.send(result);
    });
    // creating booking

    app.post("/bookings", async (req, res) => {
      const booking = req.body;
      const { package_id, tourist_email } = req.body;
      const idEmailExist = await bookingCollection
        .find({
          package_id,
          tourist_email,
        })
        .toArray();
      console.log(idEmailExist.length);
      if (idEmailExist.length > 0) {
        return res.send({ message: "You Already Ordered This" });
      }

      const result = await bookingCollection.insertOne(booking);
      res.send(result);
    });

    // get bookings with email

    app.get("/bookings/:email", async (req, res) => {
      const email = req.params.email;
      const result = await bookingCollection.find({ email }).toArray();
      res.send(result);
    });

    // getting bookings where guides email appeared
    app.get("/bookings/guide/:email", async (req, res) => {
      const email = req.params.email;
      const result = await bookingCollection
        .find({ guide_email: email })
        .toArray();
      res.send(result);
    });

    // guide updating bookings status route

    app.put("/bookings", async (req, res) => {
      const { id, status } = req.query;
      const filter = { _id: new ObjectId(id) };
      const updateBooking = {
        $set: {
          status: status,
        },
      };
      const options = { upsert: true };
      const result = await bookingCollection.updateOne(
        filter,
        updateBooking,
        options
      );
      res.send(result);
    });

    // wishlist data create with post method

    app.post("/wishlists", async (req, res) => {
      const wishlist = req.body;
      const result = await wishListCollection.insertOne(wishlist);
      res.send(result);
    });

    // wishlists data getting api

    app.get("/wishlists", async (req, res) => {
      const result = await wishListCollection.find().toArray();
      res.send(result);
    });

    // const getting wishlists by email

    app.get("/wishlists/:email", async (req, res) => {
      const email = req.params.email;
      const result = await wishListCollection.find({ email }).toArray();
      res.send(result);
    });

    // delete wishlist by id
    app.delete("/wishlist/:id", async (req, res) => {
      const id = req.params.id;
      const result = await wishListCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    // guide review apis

    app.post("/reviews/guides", async (req, res) => {
      const review = req.body;
      const result = await guideReviewCollection.insertOne(review);
      res.send(result);
    });

    // get all reviews

    app.get("/reviews/guides", async (req, res) => {
      const result = await guideReviewCollection.find().toArray();
      res.send(result);
    });
    // getting all reviews to show

    app.get("/reviews/guides/:email", async (req, res) => {
      const email = req.params.email;
      const result = await guideReviewCollection
        .find({ guide_email: email })
        .toArray();
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("home route is running");
});

app.listen(port, () => {
  console.log(`server is running at the port ${port}`);
});
