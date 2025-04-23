const fs = require('fs');
const path = require('path');
const config = require('./config.json');

module.exports = {
  enabled: config.enabled,
  register: (client) => {
    client.on('', () => {});
  },
};
