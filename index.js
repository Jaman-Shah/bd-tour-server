require("dotenv").config();
const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
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

    app.put("/users", async (req, res) => {
      const user = req.body;
      const { email } = user;
      const userExist = await userCollection.findOne({ email });
      if (userExist) {
        return;
      }
      const result = await userCollection.insertOne(user);
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
