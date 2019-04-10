# bash
set -e
# 编译
npm run build

# 参数设置
# cat package.json | awk -F"\"" '/version/{print $4}'
VERSION=`awk -F"\"" '/version/{print $4}' package.json`
VERSION=${VERSION}
URL=windsome/wechat-payment

# 打包相应版本
TAGVERSION=$URL:$VERSION
echo '开始打包:'$TAGVERSION
docker build . -t $TAGVERSION

echo '开始推送:'$TAGVERSION
docker push $TAGVERSION
echo '完成推送:'$TAGVERSION

# 打最新版本标签并推送
TAGLATEST=$URL:latest
echo '开始推送:'$TAGLATEST
docker tag $TAGVERSION $TAGLATEST
docker push $TAGLATEST
echo '完成推送:'$TAGLATEST

