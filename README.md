## 项目简介
微信支付服务,支持微信中H5-jsapi支付,微信小程序支付

## 文档
[境内普通商户-微信小程序支付](https://pay.weixin.qq.com/wiki/doc/api/wxa/wxa_api.php?chapter=7_4&index=3)
[微信小程序支付中用到的微信小程序登录](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/login.html)

## 打包发布流程
1. 编译及打包发布
```
npm install
npm run build
npm run tar
scp bz2-server.tar.bz2 root@qingshansi:/data/nodejs/jtb-api-server/
```
2. 服务器部署
```
cd /data/nodejs/jtb-api-server/
tar -jxvf bz2-server.tar.bz2
npm install

# 启动方式1: node方式
node sdist

# 启动方式2: pm2方式
DEBUG="app:*" pm2 start sdist --name jtb-api-server
pm2 save
pm2 startup
```

## docker打包及运行
1. nodejs服务打包
docker build . -t windsome/wechat-payment:1.0.1

2. 用docker运行
docker run -p 33310:3310 windsome/wechat-payment:1.0.1

## k8s部署
1. 从目录创建ConfigMap,见<https://www.jianshu.com/p/cf8705a93c6b>,需要k8s1.10.0以上版本才支持二进制文件.
```
$ scp k8s/conf.single root@xiaobei1:/data/k8s/ # 将配置文件目录拷贝的k8s服务器上.
$ kubectl create configmap wepay-cm --from-file=/data/k8s/conf.single/
configmap "wepay-cm" created
$ kubectl get configmap wepay-cm -o go-template='{{.data}}'
map[config.json:config.json
 apiclient_cert_1415522602.p12:apiclient_cert_1415522602.p12
 apiclient_cert_1525363461.p12:apiclient_cert_1525363461.p12
]
```
2. 使用Volume将ConfigMap作为文件或目录挂载
将创建的ConfigMap直接挂载至Pod的/data/wechat-payment/config目录下，其中每一个key-value键值对都会生成一个文件，key为文件名，value为内容。
```
---
apiVersion: v1
kind: Service
metadata:
  labels:
    k8s-app: wechat-payment
  name: wechat-payment
  namespace: default
spec:
  ports:
  - name: wechat-payment-port-80
    port: 80
    targetPort: 3310
    protocol: TCP
  selector:
    k8s-app: wechat-payment
---
apiVersion: apps/v1
kind: Deployment
metadata:
  labels:
    k8s-app: wechat-payment
  name: wechat-payment
  namespace: default
spec:
  replicas: 1
  selector:
    matchLabels:
      k8s-app: wechat-payment
  template:
    metadata:
      labels:
        k8s-app: wechat-payment
      name: wechat-payment
    spec:
      containers:
      - image: windsome/wechat-payment:latest
        name: wechat-payment
        imagePullPolicy: Always
        volumeMounts:
        - name: config-volume
          mountPath: /data/wechat-payment/config
      volumes:
      - name: config-volume
        configMap:
          name: wepay-cm
```

## 配置文件构造
配置文件的内容:
```
{
  "env": "<H5>or<WXAPP>or<APP>",
  "type": "<普通商户>or<服务商>",
  "appId": "<your_appId>",
  "mchId": "<your_mchId>",
  "notifyUrl": "<接收微信支付的通知的URL,本服务需要暴露给外界,并需要在微信支付后台设置>",
  "partnerKey": "<your_partnerKey>",
  "pfx": "<微信的P12文件>",
  "passphrase": "<your_passphrase>一般与mchId相同",
  "_payUrl": "<支付目录,在此SDK中不用,在H5支付中需配置在微信支付后台>",
  "cbNotifyUrl": "<本服务接受微信通知后,再通知其他微服务处理实际订单的URL>"
}
```
单个支付:
```
{
  env: 'H5',
  type: '普通商户',
  appId: 'wx9af096e5f111831a',
  mchId: '1525312341',
  notifyUrl: 'http://m.qingshansi.cn/apis/v1/wepay/pay_notify',
  partnerKey: '7gwY3krPn33c1lBzO11YXA1TdbSsjXT1',
  pfx: fs.readFileSync(__dirname + '/apiclient_cert_1525312341.p12'),
  passphrase: '1525312341',
  _payUrl: 'http://m.qingshansi.cn/eshop'
}
```
多个支付:
```
[{
  env: 'WXAPP',
  type: '普通商户',
  appId: 'wx9af096e5f111831a',
  mchId: '1525312341',
  notifyUrl: 'http://m.qingshansi.cn/apis/v1/wepay/pay_notify',
  partnerKey: '7gwY3krPn33c1lBzO11YXA1TdbSsjXT1',
  pfx: fs.readFileSync(__dirname + '/apiclient_cert_1525312341.p12'),
  passphrase: '1525312341',
  _payUrl: 'http://m.qingshansi.cn/eshop'
},{
  env: 'APP',
  type: '普通商户',
  appId: 'wx9af096e5f111831a',
  mchId: '1525312341',
  notifyUrl: 'http://m.qingshansi.cn/apis/v1/wepay/pay_notify',
  partnerKey: '7gwY3krPn33c1lBzO11YXA1TdbSsjXT1',
  pfx: fs.readFileSync(__dirname + '/apiclient_cert_1525312341.p12'),
  passphrase: '1525312341',
  _payUrl: 'http://m.qingshansi.cn/eshop'
}]
```

## 用apidoc生成接口文档
```
npm run apidoc
```

## TODO
1. 微信小程序支付
2. 微信APP支付