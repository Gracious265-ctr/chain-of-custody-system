const IPFS = require('ipfs-mini');

// Connect to local IPFS Desktop
const ipfs = new IPFS({ host: 'localhost', port: 5001, protocol: 'http' });

module.exports = ipfs;

