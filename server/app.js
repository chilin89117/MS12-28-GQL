require('dotenv').config();
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const express = require('express');
const mongoose = require('mongoose');
const auth = require('./middleware/auth');
const {deleteImg} = require('./utils');

// express, cors, images
const app = express();
const corsOptions = {
  origin: '*',
  optionsSuccessStatus: 204,
  methods: ['GET', 'PUT', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions), express.json());
app.use('/images', express.static(path.join(__dirname, 'images')));

// auth middleware to set 'req.userId' and 'req.isAuth'
app.use(auth);

// REST API for image upload
const upload = require('./middleware/multer');
app.use(upload.single('image'));
app.put('/post-image', (req, res, next) => {
  if(!req.isAuth) throw new Error('PUT /post-image: Not authenticated!');
  // file may not be sent when post is updated, so send back '200' status
  if(!req.file) return res.status(200).json({message: 'No file provided'});
  // delete old image
  if(req.body.oldImgPath) deleteImg(req.body.oldImgPath);
  return res.status(201).json({message: 'File saved', path: req.file.path});
});


// ============== GraphQL ==========================================================
const {ApolloServer, gql} = require('apollo-server-express');
const typeDefs = gql(fs.readFileSync('./graphql/schema.graphql', {encoding: 'utf-8'}));
const resolvers = require('./graphql/resolvers');
const graphqlServer = new ApolloServer({
  typeDefs,
  resolvers,
  context({req}) {
    return {userId: req.userId, isAuth: req.isAuth};
  },
  playground: true,   // set to false for production
  formatError(err) {
    if(!err.originalError) return err;  // see resolvers for 'originalError' thrown
    return {
      message: err.message || 'GraphQL: An error occurred',
      status: err.originalError.code || 500,
      data: err.originalError.data
    };
  }
});
graphqlServer.applyMiddleware({app});
//==================================================================================

// error handling
app.use((err, req, res, next) => {
  console.log(err);
  const errStatus = err.statusCode || 500;
  const errMsg = err.message;
  const errData = err.data;
  res.status(errStatus).json({errMsg, errData});
});

// start server after db connection
const port = process.env.PORT || 4000;
mongoose
  .connect(process.env.MONGOURI, {useNewUrlParser: true, poolSize: 5, useFindAndModify: false})
  .then(result => app.listen(port, () => console.log(`MS12-28-GQL on port ${port}...`)))
  .catch(err => next(err));
