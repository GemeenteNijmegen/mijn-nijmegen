'use strict';
const fs = require('fs');

require.extensions['.mustache'] = function (module, filename) {
  const content = fs.readFileSync(filename, 'utf8');
  // TypeScript's __importStar helper wraps this so that X.default === content
  // (same behaviour as @glen/jest-raw-loader)
  module.exports = content;
};
