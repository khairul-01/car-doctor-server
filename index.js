const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors({
  origin: ['http://localhost:5173'],
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// DB_USER=carDoctorUser
// DB_PASS=C14KGizmoXxbUBcl
// ACCESS_TOKEN_SECRET=efdafe1986309d8406fcf7b324053193513157e9004299a03892e02fa5025480654fc641744f2dd4f3aec31010fd8651cdd60ee87ef0dc66b0b925a5dd26c419

console.log('User name and password is =', process.env.DB_USER, process.env.DB_PASS)


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.evyc2iz.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// middleware
const logger = async (req, res, next) => {
  console.log('called', req.host, req.originalUrl);
  next();
}

const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token;
  console.log('value of token in middlewar', token)
  if(!token){
    return res.status(401).send({message: 'not authorized'});
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded)=>{
    if(err){
      console.log(err)
      return res.status(401).send({message: 'Unauthorized'});
    }
    console.log('value in the token', decoded);
    req.user = decoded;
    next()
  })
  
}

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const serviceCollection = client.db('carDoctor').collection('services');
    const bookingCollection = client.db('carDoctor').collection('bookings');
 
    // app related api
    app.post('/jwt', logger, async (req, res) => {
      const user = req.body;
      console.log(user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '1h'});
      res
      .cookie('token', token, {
        httpOnly: true,
        secure: false,
        // sameSite: 'none',
      })
      .send({success:'true'})
    })

    // service related api
    app.get('/services', logger, async (req, res) => {
      const filter = req.query;
      console.log(filter);
      const query = {
        // price: {$lte:150, $gte: 30},
        title: {$regex: filter.search, $options: 'i'}
      };
      const options = {
        sort: {
          price: filter.sort == 'asc' ? 1 : -1
        }
      };
      const cursor = serviceCollection.find(query, options);
      const result = await cursor.toArray();
      res.send(result);
    })
    app.get('/services/:id', async (req, res) => {
      const id = req.params.id;
      const options = {
        // Include only the `title` and `imdb` fields in the returned document
        projection: { title: 1, price: 1, service_id: 1, img: 1 },
      };
      const query = { _id: new ObjectId(id) };
      const result = await serviceCollection.findOne(query, options);
      res.send(result);
    })

    // bookings
    app.get('/bookings', logger, verifyToken, async (req, res) => {
      console.log(req.query.email);
      // console.log('tok tok token', req.cookies.token)
      console.log('user in the valid token', req.user);
      if(req.query.email !== req.user.email){
        res.status(403).send({message:'forbidden access'})
      }
      let query = {};
      if (req.query?.email) {
        query = { email: req.query.email };
      }
      const result = await bookingCollection.find(query).toArray();
      res.send(result);
    })
    app.post('/bookings', async (req, res) => {
      const booking = req.body;
      console.log(booking);
      const result = await bookingCollection.insertOne(booking);
      res.send(result);
    })
    app.patch('/bookings/:id', async (req, res) => {
      const id = req.params.id;
      const updatedBooking = req.body;
      console.log(updatedBooking);
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: updatedBooking.status
        },
      };
      const result = await bookingCollection.updateOne(filter, updateDoc);
      res.send(result);
    })
    app.delete('/bookings/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookingCollection.deleteOne(query);
      res.send(result);
    })

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    //  await client.close();
  }
}
run().catch(console.dir);




app.get('/', (req, res) => {
  res.send('Doctor is running')
})

app.listen(port, () => {
  console.log(`Car doctor server is running on port ${port}`);
})