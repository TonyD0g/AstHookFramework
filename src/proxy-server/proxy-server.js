const AnyProxy = require("anyproxy");
const {loadConfig} = require("../utils/loadConfig.js");

(async function initAnyProxy() {
    try {
        const config = await loadConfig();

        const options = {
            port: config.port,
            rule: require("./rules"),
            webInterface: {
                enable: true,
                webPort: config.webPort
            },
            dangerouslyIgnoreUnauthorized:true,
            throttle: 10000,
            forceProxyHttps: true,
            wsIntercept: config.isOpenWebsocket,
            silent: config.isCloseDetailedLog
        };

        const proxyServer = new AnyProxy.ProxyServer(options);

        proxyServer.on("ready", () => {
            console.log("AnyProxy 代理服务器已就绪");
        });

        proxyServer.on("error", (e) => {
            console.error("代理服务器出错:", e);
        });

        proxyServer.start();

    } catch (error) {
        console.error("初始化 AnyProxy 失败:", error);
    }
})();