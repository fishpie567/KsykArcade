const { StringDecoder } = require('string_decoder');

function jsonResponse(res, status, payload) {
  const body = JSON.stringify(payload);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Length', Buffer.byteLength(body));
  res.end(body);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const decoder = new StringDecoder('utf-8');
    let buffer = '';
    req.on('data', (chunk) => {
      buffer += decoder.write(chunk);
      if (buffer.length > 1e6) {
        reject(new Error('Request body too large'));
        req.connection.destroy();
      }
    });
    req.on('end', () => {
      buffer += decoder.end();
      if (!buffer) {
        resolve({});
        return;
      }
      try {
        const parsed = JSON.parse(buffer);
        resolve(parsed);
      } catch (error) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function notFound(res) {
  jsonResponse(res, 404, { error: 'Not found' });
}

module.exports = {
  jsonResponse,
  parseBody,
  notFound,
};
