const {HttpsProxyAgent} = require('https-proxy-agent');
const {HttpProxyAgent} = require('http-proxy-agent');
const http = require('http');
const https = require('https');
const globalAssignHookComponent = require("../components/global-assign-hook-component/core/global-assign-hook-component-main");
const {loadConfig} = require("../utils/loadConfig");

// let config;
// let agent; // 将 agent 声明移到顶部，但先不初始化
//
// (async function loadConfigAndInitAgent() {
//     try {
//         config = await loadConfig();
//         // 根据上游代理的协议决定使用哪种 Agent
//         // 假设 upstreamProxyUrl 是字符串，例如 'http://proxy.example.com:8080'
//         if (config.upstreamProxyUrl.startsWith('https:')) {
//             agent = new HttpsProxyAgent(config.upstreamProxyUrl);
//         } else if (config.upstreamProxyUrl.startsWith('http:')) {
//             agent = new HttpProxyAgent(config.upstreamProxyUrl); // 使用 HttpProxyAgent 用于 HTTP 代理
//         } else {
//             throw new Error(`Unsupported upstream proxy protocol: ${config.upstreamProxyUrl}`);
//         }
//         console.log('Upstream proxy agent initialized successfully.');
//     } catch (error) {
//         console.error('Failed to load config or initialize proxy agent:', error);
//         // 根据你的需求决定是否退出进程或采取其他措施
//         // process.exit(1);
//     }
// })();

module.exports = {
    // 某些情况下载请求发送之前就替换会失败，所以只替换响应的body比较稳妥
    * beforeSendResponse(requestDetail, responseDetail) {
        globalAssignHookComponent.process(requestDetail, responseDetail);
    }
};