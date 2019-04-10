import { EC, EM } from '../Errcode';
import _debug from 'debug';
const debug = _debug('app:commonRouter');

export default (app, router, prefix) => {
  app.use(async (ctx, next) => {
    // debug('reach api!', ctx.path, ', prefix=', prefix);
    if (ctx.path.startsWith(prefix)) {
      try {
        await next();
      } catch (e) {
        debug('error:', e);
        if (401 == e.status) {
          ctx.status = 401;
          ctx.body = {
            errcode: 401,
            message:
              'Protected resource, use (Authorization: Bearer <TOKEN>) header to get access. '
          };
          //ctx.body = 'Protected resource, use Authorization header to get access\n';
        } else {
          let errcode = e.errcode || -1;
          let message = EM[errcode] || e.message || '未知错误';
          ctx.body = { errcode, message, xOrigMsg: e.message };
        }
        return;
      }
    } else {
      await next();
    }
  });
  app.use(router.routes()).use(router.allowedMethods());
  app.use(async (ctx, next) => {
    if (ctx.path.startsWith(prefix)) {
      let errcode = EC.ERR_NO_SUCH_API;
      let message = EM[errcode] || 'no such api: ' + ctx.path;
      ctx.body = { errcode, message };
      return;
    }
    await next();
  });
};
