const multer = require('multer');
const _ = require('lodash');

const fileFilter = (req, file, cb) => {
  cb(null, _.includes(['image/png', 'image/jpg', 'image/jpeg'], file.mimetype));
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'images'),
  filename: (req, file, cb) => cb(null, `${Date.now()}_${file.originalname}`)
});
 
module.exports = multer({storage, fileFilter});
