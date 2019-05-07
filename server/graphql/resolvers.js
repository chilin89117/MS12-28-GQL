const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const val = require('validator');
const {ObjectID} = require('mongodb');
const User = require('../models/User');
const Post = require('../models/Post');
const {deleteImg} = require('../utils');

const Query = {
  login: async (parent, {email, password}, ctx, info) => {
    const user = await User.findOne({email});
    if(!user) {
      const error = new Error('login: User not found');
      error.code = 401;
      throw error;
    }
    const passwordMatch = await bcrypt.compare(password, user.password);
    if(!passwordMatch) {
      const error = new Error('login: Incorrect password');
      error.code = 401;
      throw error;
    }
    const token = jwt.sign(
      {userId: user._id.toString(), email: user.email},
      process.env.JWT_SECRET,
      {expiresIn: '1d'}
    );
    return {token, userId: user._id.toString()};
  },

  getPosts: async (parent, {page}, {userId, isAuth}, info) => {
    if(!isAuth) {
      const error = new Error('getPosts: Not authenticated');
      error.code = 401;
      throw error;
    }
    if(!page) page = 1;
    const perPage = 2;
    const count = await Post.countDocuments();
    const posts = await Post
      .find()
      .sort({createdAt: -1})
      .populate('creator')
      .skip((page - 1) * perPage)
      .limit(perPage);
    return {count, posts: posts.map(p => ({...p._doc, _id: p._id.toString(), createdAt: p.createdAt.toISOString()}))};
  },

  getPost: async (parent, {id}, {userId, isAuth}, info) => {
    if(!isAuth) {
      const error = new Error('getPost: Not authenticated');
      error.code = 401;
      throw error;
    }
    const post = await Post
      .findById(id)
      .populate('creator');
    if(!post) {
      const error = new Error('getPost: No post found');
      error.code = 404;
      throw error;
    }
    return {
      ...post._doc, 
      _id: post._id.toString(),
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString()
    };
  },

  getUser: async (parent, args, {userId, isAuth}, info) => {
    // check authentication
    if(!isAuth) {
      const error = new Error('getUser: Not authenticated');
      error.code = 401;
      throw error;
    }
    // find user
    const user = await User.findById(userId);
    if(!user) {
      const error = new Error('getUser: User not found');
      error.code = 404;
      throw error;
    }
    return {...user._doc, _id: user._id.toString()};
  }
};

const Mutation = {
  signup: async (parent, {input}, ctx, info) => {
    // validate inputs
    const {email, password, name} = input;
    const errArr = [];
    if(!val.isEmail(email)) errArr.push({message: 'Invalid email format'});
    if(val.isEmpty(password) || !val.isLength(password, {min: 6, max: 20})) errArr.push({message: 'Password must be 6 to 20 characters long'});
    if(val.isEmpty(name) || !val.isLength(name, {min: 2, max: 15})) errArr.push({message: 'Name must be 2 to 15 characters long'});
    if(errArr.length > 0) {
      const error = new Error('signup: Invalid input');
      error.data = errArr;
      error.code = 422;
      throw error;
    }

    const existingUser = await User.findOne({email});
    if(existingUser) throw new Error('signup: User already exists');
    const hashed = await bcrypt.hash(password, 12);
    const user = new User({
      email,
      password: hashed,
      name
    });
    const newUser = await user.save();
    return {...newUser._doc, _id: newUser._id.toString()};
  },

  createPost: async (parent, {input}, {userId, isAuth}, info) => {
    // check authentication
    if(!isAuth) {
      const error = new Error('createPost: Not authenticated');
      error.code = 401;
      throw error;
    }
    // validate inputs
    const {title, content, imageUrl} = input;
    const errArr = [];
    if(val.isEmpty(title) || !val.isLength(title, {min: 5, max: 255})) errArr.push({message: 'Title must be 5 to 255 characters long'});
    if(val.isEmpty(content) || !val.isLength(content, {min: 5, max: 255})) errArr.push({message: 'Content must be 5 to 255 characters long'});
    if(errArr.length > 0) {
      const error = new Error('createPost: Invalid input');
      error.data = errArr;
      error.code = 422;
      throw error;
    }
    // create post
    const newPost = await Post.create({title, content, imageUrl, creator: ObjectID(userId)});
    if(!newPost) throw new Error('createPost: Create post failed');
    // add created post to user's 'posts' array
    const user = await User.findByIdAndUpdate(userId, {$push: {posts: newPost}}, {new: true});
    if(!user) throw new Error('createPost: User update failed');
    return {
      ...newPost._doc,
      _id: newPost._id.toString(),
      creator: user,  // return 'user' object instead of just ObjectId to get 'creator{name}'
      createdAt: newPost.createdAt.toISOString(),
      updatedAt: newPost.updatedAt.toISOString()
    };
  },

  updatePost: async (parent, {id, input}, {userId, isAuth}, info) => {
    // check authentication
    if(!isAuth) {
      const error = new Error('updatePost: Not authenticated');
      error.code = 401;
      throw error;
    }
    // validate inputs
    const {title, content, imageUrl} = input;
    const errArr = [];
    if(val.isEmpty(title) || !val.isLength(title, {min: 5, max: 255})) errArr.push({message: 'Title must be 5 to 255 characters long'});
    if(val.isEmpty(content) || !val.isLength(content, {min: 5, max: 255})) errArr.push({message: 'Content must be 5 to 255 characters long'});
    if(errArr.length > 0) {
      const error = new Error('updatePost: Invalid input');
      error.data = errArr;
      error.code = 422;
      throw error;
    }
    // update post
    let updatedPost;
    if(imageUrl !== 'undefined') {
      // set new 'imageUrl'
      updatedPost = await Post.findOneAndUpdate(
        {_id: ObjectID(id), creator: ObjectID(userId)},
        {$set: {title, content, imageUrl}},
        {new: true});
    } else {
      // do not update 'imageUrl'
      updatedPost = await Post.findOneAndUpdate(
        {_id: ObjectID(id), creator: ObjectID(userId)},
        {$set: {title, content}},
        {new: true});
    }
    // check update result
    if(!updatedPost) {
      const error = new Error('updatePost: Not authorized or post not found');
      error.code = 404;
      throw error;
    }
    const user = User.findById(userId);
    // return updated result
    return {
      ...updatedPost._doc,
      _id: updatedPost._id.toString(),
      creator: user,  // return 'user' object instead of just ObjectId to get 'creator{name}'
      createdAt: updatedPost.createdAt.toISOString(),
      updatedAt: updatedPost.updatedAt.toISOString()
    };
  },

  deletePost: async (parent, {id}, {userId, isAuth}, info) => {
    // check authentication
    if(!isAuth) {
      const error = new Error('deletePost: Not authenticated');
      error.code = 401;
      throw error;
    }
    // delete post
    const delPost = await Post.findOneAndDelete({_id: ObjectID(id), creator: ObjectID(userId)});
    if(!delPost) {
      const error = new Error('deletePost: Not authorized or post not found');
      error.code = 404;
      throw error;
    }
    // delete image from filesystem and user's 'posts' array
    deleteImg(delPost.imageUrl);
    const user = await User.findByIdAndUpdate(userId, {$pull: {posts: ObjectID(id)}});
    if(!user) throw new Error('deletePost: User update failed');
    return true;
  },

  updateStatus: async (parent, {status}, {userId, isAuth}, info) => {
    // check authentication
    if(!isAuth) {
      const error = new Error('updateStatus: Not authenticated');
      error.code = 401;
      throw error;
    }
    const user = await User.findByIdAndUpdate(userId, {$set: {status: status}}, {new: true});
    if(!user) throw new Error('updateStatus: Update status failed');
    return {...user._doc, _id: user._id.toString()};
  }
}

module.exports = {Query, Mutation};
