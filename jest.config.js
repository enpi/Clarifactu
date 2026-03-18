const path = require('path');

module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/unit/**/*.test.js', '**/tests/integration/**/*.test.js'],
  moduleNameMapper: {
    // Redirect better-sqlite3 to the Node-compatible version installed in tests/
    '^better-sqlite3$': path.join(__dirname, 'tests', 'node_modules', 'better-sqlite3')
  }
};
