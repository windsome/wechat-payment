import _debug from 'debug';
const debug = _debug('app:mainserver');
import 'isomorphic-fetch';
import Koa from 'koa';
import convert from 'koa-convert';
import cors from 'koa2-cors';
import parseUserAgent from './utils/userAgent';

let packageJson = require('../package.json');
debug('SOFTWARE VERSION:', packageJson.name, packageJson.version);

const app = new Koa();
app.proxy = true;

// 具体参数我们在后面进行解释
app.use(
  cors({
    origin: ctx => {
      return '*';
      // if (ctx.url === '/test') {
      //     return "*"; // 允许来自所有域名请求
      // }
      // return 'http://localhost:8080'; / 这样就能只允许 http://localhost:8080 这个域名的请求了
    },
    // exposeHeaders: ['WWW-Authenticate', 'Server-Authorization'],
    // maxAge: 5,
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE']
    // allowHeaders: ['Content-Type', 'Authorization', 'Accept'],
  })
);

let bodyParser = require('koa-bodyparser');
app.use(convert(bodyParser()));

app.use(async (ctx, next) => {
  let dateStart = new Date();
  let dbginfo = {
    client: ctx.request.header['X-Real-IP'] || ctx.request.ip,
    cookie: ctx.headers.cookie,
    // Authorization: ctx.request.header['Authorization'],
    query: ctx.request.query,
    body: ctx.request.body,
    referer: ctx.req.headers.referer,
    agent: ctx.request.header['user-agent'],
    parsedAgent: parseUserAgent(ctx.request.header['user-agent'])
    // header: ctx.request.header,
    // session: ctx.session
  };
  if (ctx.path !== '/apis/v1/utils/debug') {
    debug('[' + ctx.method + ' ' + ctx.path + '] ', JSON.stringify(dbginfo));
  } else {
    // 客户端调试打印.
    debug('>> ', ctx.request.body);
  }

  await next();
  if (ctx.path !== '/apis/v1/utils/debug') {
    debug(
      '[' + ctx.method + ' ' + ctx.path + '] time=',
      (new Date().getTime() - dateStart.getTime()) / 1000
    );
  }
});

let WepayApis = require('./apis/apiWepay').default;
app.wepay = new WepayApis(app);

app.use((ctx, next) => {
  debug('not done! [' + ctx.method + ' ' + ctx.path + ']');
  ctx.status = 404;
});

export default app;
