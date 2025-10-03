const { DataStore } = require('../utils/dataStore');

class GameService {
  constructor(baseDir) {
    this.games = new DataStore(baseDir, 'games');
    this.bootstrap().catch((error) => {
      console.error('Failed to bootstrap games', error);
    });
  }

  async bootstrap() {
    const existing = await this.games.read();
    if (existing.length === 0) {
      await this.games.write([
        {
          id: 'euro-clicker',
          name: 'Euro Clicker',
          description: 'Click the button as fast as you can to earn bragging rights.',
          slug: 'euro-clicker',
          tags: ['casual'],
        },
        {
          id: 'coming-soon',
          name: 'Mystery Machine',
          description: 'A surprise arcade adventure is on the way!',
          slug: 'coming-soon',
          tags: ['soon'],
        },
      ]);
    }
  }

  async listGames() {
    const games = await this.games.read();
    return games;
  }
}

module.exports = { GameService };
