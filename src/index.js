///////////////////////////////////////////////////
// koa web server for all APPs.
///////////////////////////////////////////////////
var http = require('http');

require('babel-register');
let server = require('./mainserver').default;
let _debug = require('debug');
const debug = _debug('app:bin:server');

const port = 3310;

http.createServer(server.callback()).listen(port);
debug(`Server accessible via http://localhost:${port} `);
