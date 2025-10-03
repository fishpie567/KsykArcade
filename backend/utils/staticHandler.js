const fs = require('fs');
const path = require('path');

const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain',
};

function staticHandler(req, res, rootDir) {
  const safePath = sanitizePath(req.url.split('?')[0]);
  let filePath = path.join(rootDir, safePath);
  if (filePath.endsWith('/')) {
    filePath = path.join(filePath, 'index.html');
  }
  if (!filePath.startsWith(rootDir)) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      const fallback = path.join(rootDir, 'index.html');
      fs.createReadStream(fallback)
        .on('error', () => {
          res.statusCode = 404;
          res.end('Not found');
        })
        .pipe(res);
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
    fs.createReadStream(filePath).pipe(res);
  });
}

function sanitizePath(requestPath) {
  const decoded = decodeURIComponent(requestPath);
  return decoded.replace(/\.\.+/g, '.');
}

module.exports = { staticHandler };
