const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'database.json');

function readDatabase() {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ users: [], transactions: [], passwordResetTokens: [] }, null, 2));
  }
  const raw = fs.readFileSync(DB_PATH, 'utf-8');
  return JSON.parse(raw);
}

function writeDatabase(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function withDatabase(callback) {
  const data = readDatabase();
  const result = callback(data);
  if (result !== false) {
    writeDatabase(data);
  }
  return result;
}

module.exports = {
  readDatabase,
  writeDatabase,
  withDatabase,
};
