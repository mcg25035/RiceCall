const fs = require('fs');
const path = require('path');
const config = require('./config.json');

module.exports = {
  enabled:
    Date.now() >= new Date(config.start) && Date.now() <= new Date(config.end),
  register: (client) => {},
};
