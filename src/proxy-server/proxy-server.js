const AnyProxy = require("anyproxy");
const {loadConfig} = require("../utils/loadConfig.js");

(async function initAnyProxy() {
    try {
        const config = await loadConfig();

        const options = {
            port: config.port,
            rule: require("./rules"),
            webInterface: {
                enable: config.is_open_web_server,
                webPort: config.web_port
            },
            dangerouslyIgnoreUnauthorized: true,
            throttle: 10000,
            forceProxyHttps: true,
            wsIntercept: config.is_open_websocket,
            silent: config.is_close_detailedLog
        };

        const proxyServer = new AnyProxy.ProxyServer(options);

        proxyServer.on("ready", () => {
            console.log(`AnyProxy 代理服务器已开启在 ${config.port} 端口上,请给浏览器代理插件设置该端口即可`);

            if (config.is_open_web_server) console.log(`AnyProxy 代理服务器的web页面在 http://127.0.0.1:${config.web_port} 上`);
        });

        proxyServer.on("error", (e) => {
            console.error("代理服务器出错:", e);
        });

        proxyServer.start();

    } catch (error) {
        console.error("初始化 AnyProxy 失败:", error);
    }
})();