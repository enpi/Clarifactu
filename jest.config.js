module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/unit/**/*.test.js', '**/tests/integration/**/*.test.js']
  // better-sqlite3 13 is built on Node-API: the same binary runs in Node (tests) and
  // Electron (app), so the tests no longer need a separate Node build of it.
};
