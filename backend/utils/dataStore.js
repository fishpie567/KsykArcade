const fs = require('fs');
const path = require('path');

class DataStore {
  constructor(baseDir, name) {
    this.baseDir = baseDir;
    this.file = path.join(baseDir, `${name}.json`);
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }
    if (!fs.existsSync(this.file)) {
      fs.writeFileSync(this.file, '[]', 'utf-8');
    }
  }

  async read() {
    const data = await fs.promises.readFile(this.file, 'utf-8');
    try {
      return JSON.parse(data);
    } catch (error) {
      console.warn(`Failed to parse ${this.file}, resetting`, error);
      await fs.promises.writeFile(this.file, '[]', 'utf-8');
      return [];
    }
  }

  async write(items) {
    const tmp = `${this.file}.tmp`;
    await fs.promises.writeFile(tmp, JSON.stringify(items, null, 2));
    await fs.promises.rename(tmp, this.file);
  }
}

module.exports = { DataStore };
