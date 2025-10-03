const fs = require('fs');
const path = require('path');

function loadEnv(filePath) {
  try {
    const resolved = path.resolve(filePath);
    if (!fs.existsSync(resolved)) {
      return;
    }
    const contents = fs.readFileSync(resolved, 'utf-8');
    contents.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        return;
      }
      const [key, ...rest] = trimmed.split('=');
      const value = rest.join('=').trim();
      if (!(key in process.env)) {
        process.env[key] = value;
      }
    });
  } catch (error) {
    console.warn('Could not load env file', error);
  }
}

module.exports = { loadEnv };
