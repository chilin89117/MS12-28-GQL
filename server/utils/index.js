const fs = require('fs');

const deleteImg = path => {
  fs.unlink(path, err => {
    console.log(`deleteImg: ${path} is deleted.`);   // ignore error if any
  });
};

module.exports = {deleteImg};
