const globalAssignHookComponent = require("../components/global-assign-hook-component/core/global-assign-hook-component-main");
const {loadConfig} = require("../utils/loadConfig");

let config;
(async function loadConfigAndInitAgent() {
    try {
        config = await loadConfig();
    } catch (error) {
        console.error('Failed to load config:', error);
    }
})();

module.exports = {
    // 某些情况下,请求发送之前就替换会失败，所以只替换响应的body比较稳妥
    * beforeSendResponse(requestDetail, responseDetail) {
        globalAssignHookComponent.process(requestDetail, responseDetail);
    },

    * beforeSendRequest(requestDetail) {
        if (config.is_open_proxy === false) return requestDetail;

        try {

            const parsedUrl = new URL(config.proxy_url);
            const requestOption = requestDetail.requestOptions;
            requestOption.hostname = parsedUrl.hostname;

            if (parsedUrl.port === "" || parsedUrl.port === null){
                if (requestDetail.protocol === "http"){
                    parsedUrl.port = "80"
                }else {
                    parsedUrl.port = "443"
                }
            }
            requestOption.port = parsedUrl.port;
            requestOption.path = config.proxy_url;
        } catch (error) {
            return requestDetail;
        }
        return requestDetail;
    }
};