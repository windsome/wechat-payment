import _debug from 'debug';
const debug = _debug('app:apiWepay');
import _ from 'lodash';
import getRawBody from 'raw-body';
import fs from 'fs';
import WechatPay from '../lib/wepay';
import Errcode, { EC } from '../Errcode';
import CommonRouterFix from './commonRouter';
import type from '../utils/type';
import { requestPost } from '../utils/_request';

const base_cfg_folder = '/data/wechat-payment/config/';
/**
 * 支付整体过程:
 * 1. 用户在客户端选中一个或一系列商品,生成一个订单.
 * 2. 给用户显示订单详情,根据订单状态,调用微信支付弹出支付确认框.
 * 3. 用户输入密码确认付款,客户端则处于支付结果等待页面(每隔1秒向服务器请求订单状态).
 * 4. 服务器端会收到微信发来的支付结果(微信主动调用http://m.qingshansi.cn/apis/v1/wepay/pay_notify)
 * 5. 服务器端处理微信服务器发来的支付结果,并处理,修改订单状态,返回微信处理结果.
 * 6. 客户端确认订单新状态后,提示客户成功还是失败.
 * 7. 订单成功后,如果是直接使用的,如VIP会员卡,则直接使用了.
 */
export default class Apis {
  constructor(app) {
    this.app = app;

    this.init();
    this.registerServices();
  }

  init = () => {
    debug('init WechatPay');
    try {
      let config = JSON.parse(fs.readFileSync( base_cfg_folder+'config.json'));
      let cfg0 = null;
      if (config) {
        let typeconfig = type(config);
        if (typeconfig === 'array') cfg0 = config[0];
        else cfg0 = config;
      }
      this.cfg = cfg0;
    } catch (error) {
      debug('error!', error);
    }
    if(this.cfg) {
      let pfx = fs.readFileSync(base_cfg_folder+this.cfg.pfx);
      this.cfg.pfx = pfx;
    }
    debug('wechat payment config: ', this.cfg);
    this.wepay = new WechatPay(this.cfg);
  };

  registerServices() {
    // init router for apis.
    let prefix = '/apis/v1/wepay';
    let router = require('koa-router')({ prefix });
    router.all('/pay_notify', this.payNotify);
    router.post('/get_pay_request_params', this.getPayRequestParams);
    router.post('/refund', this.refund);
    //sandbox
    router.post('/get_sign_key', this.getSandboxSignKey);

    CommonRouterFix(this.app, router, prefix);
  }

  ///////////////////////////////////////////////////
  // wechat pay.
  ///////////////////////////////////////////////////
  payNotify = async (ctx, next) => {
    let rawText = await getRawBody(ctx.req, {
      encoding: 'utf-8'
    });
    //debug ("get notify: ", rawText);
    try {
      let retobj = await this.wepay.notifyParse(rawText);
      debug('payNotify parsed:', retobj);
      if (!retobj) {
        throw new Error('pay notify get null!');
      }
      if (retobj.return_code != 'SUCCESS') {
        throw new Error(
          'error! pay notify error! return_code=' +
            retobj.return_code +
            ', return_msg=' +
            retobj.return_msg
        );
      }

      // notify others.
      let result = await this._notifyPayment(retobj);
      debug('_notifyPayment:', result);

      let xml = this.wepay.notifyResult({
        return_code: 'SUCCESS',
        return_msg: 'OK'
      });
      debug('payNotify process ok: ', xml);
      ctx.body = xml;
    } catch (e) {
      debug('payNotify error: ', e);
      let xml = this.wepay.notifyResult({
        return_code: 'FAIL',
        return_msg: 'FAIL'
      });
      ctx.body = xml;
    }
  };

  _notifyPayment = async (notification) => {
    let cbUrl = this.cfg && this.cfg.cbNotifyUrl;
    if (!cbUrl) {
      throw new Error('no cbNotifyUrl!');
    }
    let retobj = await requestPost(cbUrl, notification);
    if (!retobj) {
      throw new Error('no result from cbUrl!');
    }
    if (retobj.errcode) {
      throw retobj;
    }
    return retobj;
  }

  /**
   * @api {POST} /apis/v1/wepay/getPayRequestParams 获取订单wepay支付参数
   * @apiDescription `Content-Type="application/json"` 获取订单wepay支付参数
   * 1. 查询某id的订单,判断此订单是否为可支付状态.
   * 2. 构建微信订单信息.
   * 3. 调用wepay.getBrandWCPayRequestParams()获得支付参数.
   * 6. 返回结果
   * @apiName other-getPayRequestParams
   * @apiGroup apiWepay
   * @apiVersion 1.0.0
   * @apiContentType application/json
   * @apiParamExample {json} Request-Example:
   * {
   *  id: '5ba27cc3a70db45dd108b53f', // 订单id
   *  fee: 1200, // 订单金额,以分为单位
   *  body: '商品描述:袜子1件+衣服2件', // 必选, string(128) 商品描述
   *  detail: '商品详情:2019赛季球衣 蓝色 L 高领 2件; 球袜 红色 小 1件' // 可选, string(600) 商品详情
   *  attach: '附加数据:福州路店', // 可选, string(127) 附加数据
   * }
   */
  getPayRequestParams = async (ctx, next) => {
    let orderId = ctx.params.id || ctx.request.body.id || ctx.request.query.id;
    if (!orderId) {
      throw new Errcode('error! param order.id=null!', EC.ERR_PARAM_ERROR);
    }

    let args = ctx.request.body || {};
    let { fee, openid, body = '', detail = '', attach = '', ip } = args;
    ip = ip || ctx.request.ip;

    // 组装订单信息.
    if (!fee) {
      // 无需资金支付,直接修改状态为已支付.
      throw new Errcode(
        'error! no need pay, order.id=' + orderId,
        EC.ERR_ORDER_NO_NEED_PAID
      );
    }

    let trade = {
      body: body.substr(0, 127),
      detail: detail.substr(0, 600),
      attach: attach.substr(0, 127),
      out_trade_no: orderId,
      total_fee: fee,
      // sub_openid: openid,
      trade_type: 'JSAPI',
      spbill_create_ip: ip
    };
    if (this.cfg.type === '普通商户') trade = { ...trade, openid: openid };
    else trade = { ...trade, sub_openid: openid };

    debug('about to getBrandWCPayRequestParams()', trade);
    let params = await this.wepay.getBrandWCPayRequestParams(trade);
    if (!params || !(params.package && params.paySign)) {
      throw new Errcode(
        'error! getBrandWCPayRequestParams() return null! orderId=' + orderId,
        EC.ERR_PAY_PARAMS_ERROR
      );
    }

    ctx.body = {
      errcode: 0,
      result: params
    };
  };

  getSandboxSignKey = async (ctx, next) => {
    let params = await this.wepay.getSignKey();
    ctx.body = {
      errcode: 0,
      result: params
    };
  };

  refund = async (ctx, next) => {
    let order = ctx.request.body || {};
    let retobj = await this.wepay.refund({ ...order });
    debug('refund result:', retobj);
    ctx.body = {
      errcode: 0,
      result: retobj
    };
  };
}
