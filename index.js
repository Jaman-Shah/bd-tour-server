require("dotenv").config();
const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId, Long } = require("mongodb");
const app = express();
const cors = require("cors");
const port = process.env.PORT || 5006;
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://tourist-guide-jaman-shah.web.app",
    ],
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
    const paymentCollection = db.collection("payments");
    const wishListCollection = db.collection("wishlists");
    const guideReviewCollection = db.collection("guide_reviews");
    const storyCollection = db.collection("stories");

    // jwt token creating

    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.JWT_SECRET_KEY, {
        expiresIn: "1d",
      });
      res.send({ token });
    });

    // verify token
    const verifyToken = async (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "Unauthorized access" });
      }
      const token = req.headers.authorization.split(" ")[1];

      jwt.verify(token, process.env.JWT_SECRET_KEY, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "Unauthorized access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    const verifyGuide = async (req, res, next) => {
      const emailInToken = req.decoded.email;
      const guide = await userCollection.findOne({ email: emailInToken });
      if (guide.role !== "guide") {
        return res.status(403).send({ message: "Forbidden" });
      }
      next();
    };

    const verifyAdmin = async (req, res, next) => {
      try {
        const emailInToken = req.decoded.email;
        console.log("Decoded email from token:", emailInToken);

        const admin = await userCollection.findOne({ email: emailInToken });
        console.log("Admin fetched from DB:", admin);

        if (!admin) {
          return res.status(404).send({ message: "User not found" });
        }

        console.log("Admin role from DB:", admin.role);

        if (admin.role !== "admin") {
          return res.status(403).send({ message: "Forbidden" });
        }

        next();
      } catch (error) {
        console.error("Error in verifyAdmin middleware:", error);
        return res.status(500).send({ message: "Internal Server Error" });
      }
    };

    // payment related api

    app.post("/create-payment-intent", async (req, res) => {
      const price = req.body.price;
      const priceInCent = parseFloat(price) * 100;
      if (!price || priceInCent < 1) return;
      const { client_secret } = await stripe.paymentIntents.create({
        amount: priceInCent,
        currency: "usd",
        // In the latest version of the API, specifying the `automatic_payment_methods` parameter is optional because Stripe enables its functionality by default.
        automatic_payment_methods: {
          enabled: true,
        },
      });

      res.send({ clientSecret: client_secret });
    });

    /**--------------------------------->
     * services Related API******************>
     * --------------------------------->
     */

    // getting users
    app.get("/users", async (req, res) => {
      const page = parseInt(req.query.page);
      const size = parseInt(req.query.size);
      const { name, role } = req.query;
      let query = {};
      if (name) {
        query.name = { $regex: name, $options: "i" };
      }
      if (role) {
        query.role = role;
      }
      const result = await userCollection
        .find(query)
        .skip((page - 1) * size)
        .limit(size)
        .toArray();
      res.send(result);
    });

    // getting users length for pagination

    app.get("/users/count", async (req, res) => {
      const result = await userCollection.estimatedDocumentCount();
      res.send({ count: result });
    });

    // getting single users info with email

    app.get("/user/:email", async (req, res) => {
      const email = req.params.email;
      console.log(email);
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

    // get packages by type
    app.get("/packages/:type", async (req, res) => {
      const type = req.params.type;
      const result = await packageCollection.find({ type }).toArray();
      res.send(result);
    });

    // creating packages

    app.post("/packages", async (req, res) => {
      const package = req.body;
      const result = await packageCollection.insertOne(package);
      res.send(result);
    });

    // updating user api

    app.put("/updateuser", verifyToken, async (req, res) => {
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
    app.put("/users", verifyToken, async (req, res) => {
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
    app.get("/bookings", verifyToken, async (req, res) => {
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

      if (idEmailExist.length > 0) {
        return res.send({ message: "You Already Ordered This" });
      }

      const result = await bookingCollection.insertOne(booking);
      res.send(result);
    });

    // get bookings with email

    app.get("/bookings/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const result = await bookingCollection
        .find({ tourist_email: email })
        .toArray();
      res.send(result);
    });

    // booking count router for checking how many times a user is making booking
    app.get("/bookings/count/:email", async (req, res) => {
      const email = req.params.email;
      const count = await bookingCollection.countDocuments({
        tourist_email: email,
      });
      res.send({ count });
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

    // deleting a booking

    app.delete("/booking/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookingCollection.deleteOne(query);
      res.send(result);
    });

    // wishlist data create with post method

    app.post("/wishlists", async (req, res) => {
      const wishlist = req.body;
      const result = await wishListCollection.insertOne(wishlist);
      res.send(result);
    });

    // wishlists data getting api

    app.get("/wishlists", verifyToken, async (req, res) => {
      const result = await wishListCollection.find().toArray();
      res.send(result);
    });

    // const getting wishlists by email

    app.get("/wishlists/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const result = await wishListCollection.find({ email }).toArray();
      res.send(result);
    });

    // delete wishlist by id
    app.delete("/wishlist/:id", verifyToken, async (req, res) => {
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
        .sort({ _id: -1 })
        .toArray();

      res.send(result);
    });

    // story collection apis

    app.post("/stories", async (req, res) => {
      const story = req.body;
      const result = await storyCollection.insertOne(story);
      res.send(result);
    });

    // getting all stories route
    app.get("/stories", async (req, res) => {
      const result = await storyCollection.find().toArray();
      res.send(result);
    });

    // getting single story by id

    app.get("/stories/:id", async (req, res) => {
      const id = req.params.id;
      const result = await storyCollection.findOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    // payment collection api

    app.put("/payment", async (req, res) => {
      const { _id: booking_id, ...paymentInfo } = req.body;

      // Insert payment info into the payment collection
      const resultOfPayment = await paymentCollection.insertOne(paymentInfo);

      // Update the booking status to 'Paid'
      const filter = { _id: new ObjectId(booking_id) };
      const updateBooking = {
        $set: {
          status: "Paid",
        },
      };

      const resultOfBooking = await bookingCollection.updateOne(
        filter,
        updateBooking
      );

      res.send({ resultOfPayment, resultOfBooking });
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
