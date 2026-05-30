const express = require('express');
const path = require('path');

module.exports = function(app) {
  // Serve static files from public/data with correct MIME type
  app.use('/data', express.static(path.join(__dirname, '..', 'public', 'data'), {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.txt')) {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      }
    }
  }));
};
