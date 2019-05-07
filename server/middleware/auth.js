const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  const authInHeader = req.get('Authorization');
  if(!authInHeader) {
    req.isAuth = false;
    return next();
  }
  const token = authInHeader.replace('Bearer ', '');
  let decodedToken;
  try {
    decodedToken = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    req.isAuth = false;
    return next();
  }
  if(!decodedToken) {
    req.isAuth = false;
    return next();
  }
  req.userId = decodedToken.userId;
  req.isAuth = true;
  next();
};
