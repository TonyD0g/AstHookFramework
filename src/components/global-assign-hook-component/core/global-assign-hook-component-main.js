const fs = require("fs");
const shell = require("shelljs");
const crypto = require("crypto");
const cheerio = require("cheerio");
const {minify, minify_sync} = require("terser");

const {loadConfig} = require("../../../utils/loadConfig.js");
const {loadPluginsAsStringWithCache} = require("./plugins-manager");
const {positioningEncryptionHook} = require("./inject-hook");
// const AnyProxy = require("anyproxy");
const {registerFunctionsInWindow} = require("../plugins/register-function-in-window");

// 注入Hook成功的文件暂存到哪个目录下，因为注入实在是太慢了，落盘以应对频繁重启
const injectSuccessJsFileCacheDirectory = "./js-file-cache";
const injectSuccessJsFileCacheMetaFile = `${injectSuccessJsFileCacheDirectory}/meta.jsonl`

let config;
(async function loadConfigAndInitAgent() {
    try {
        config = await loadConfig();
    } catch (error) {
        console.error('Failed to load config:', error);
    }
})();

const injectSuccessJsFileCache = new Map();

const disableCache = false;

(function initInjectSuccessJsFileCache() {
    ensureDirectoryExists(injectSuccessJsFileCacheDirectory);
    if (!exists(injectSuccessJsFileCacheMetaFile)) {
        return;
    }
    const metaStr = fs.readFileSync(injectSuccessJsFileCacheMetaFile).toString();
    if (!metaStr) {
        return;
    }
    metaStr.split("\n").forEach(line => {
        if (!line) {
            return;
        }
        const meta = JSON.parse(line);
        injectSuccessJsFileCache.set(meta.url, meta);
    });
    console.log(`缓存文件已加载完毕，目前有缓存 ${injectSuccessJsFileCache.size}个`);
})();

function matchDomain(matchDomainExp, url) {
    try {
        const parsedUrl = new URL(url);
        if (parsedUrl.hostname && matchDomainExp === parsedUrl.hostname) return true;
    } catch (e) {
        return false;
    }
    return false;
}

// 注意! : 此方法不能使用异步,否则将无法正常hook !!!
function process(requestDetail, responseDetail) {

    if (isHtmlResponse(responseDetail)) {
        try {
            processHtmlResponse(requestDetail, responseDetail);
        } catch (e) {
            console.error(e);
        }
        return;
    }

    let fileName = requestDetail.url.substring(requestDetail.url.lastIndexOf('/') + 1);

    // 引入一个黑名单,对"无意义"的js文件进行跳过,防止hook这些库代码让页面直接崩溃(能在config文件中进行配置)
    let isSuccessMatch = false;
    let hookTargetType = "";
    let hookTargetValue = "";
    for (const current_skip_js of config.skip_js_list) {
        if (current_skip_js.type === "str" && current_skip_js.value === fileName) {
            isSuccessMatch = true
        } else if (current_skip_js.type === "regex" && matchByRegExp(current_skip_js.value, fileName)) {
            isSuccessMatch = true
        }
        if (isSuccessMatch) break
    }
    if (isSuccessMatch) return;

    if (!isJavaScriptResponse(responseDetail)) return;

    if (config.is_open_hook_target) {
        // 支持选择性对特定URL/符合正则的URL进行AST Hook
        isSuccessMatch = false;
        hookTargetType = "";
        hookTargetValue = "";
        for (const current_hook_target of config.hook_target) {
            if (current_hook_target.type === "url" && current_hook_target.value === requestDetail.url) {
                isSuccessMatch = true
            } else if (current_hook_target.type === "regex" && matchByRegExp(current_hook_target.value, requestDetail.url)) {
                isSuccessMatch = true
            } else if (current_hook_target.type === "domain" && matchDomain(current_hook_target.value, requestDetail.url)) {
                isSuccessMatch = true
            }
            if (isSuccessMatch) {
                hookTargetType = current_hook_target.type;
                hookTargetValue = current_hook_target.value;
                break
            }
        }

        if (!isSuccessMatch) return

        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0'); // 月份从0开始，所以加1
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');

        // 丰富日志: 告知用户对实际哪一个js文件进行hook
        console.log(`[+] ${year}-${month}-${day}-${hours}:${minutes} 开始对类型为: ${hookTargetType}, 值为: ${hookTargetValue}, 目标为: ${fileName} 的数据开始Hook`);
    }

    try {
        processJavaScriptResponse(requestDetail, responseDetail);
    } catch (e) {
        console.error(e);
    }
}

function isRegExpCorrect(inputRegex) {
    try {
        new RegExp(inputRegex);
        return true;
    } catch (error) {
        console.error("[-] 存在非法正则表达式! 请检查config.json中的正则: ", inputRegex);
        return false
    }
}


function matchByRegExp(inputRegex, testString) {
    if (!isRegExpCorrect(inputRegex)) return false;
    let realRegExp = new RegExp(inputRegex);
    return realRegExp.test(testString);
}

// 判断是否是HTML类型的响应内容
function isHtmlResponse(responseDetail) {
    for (let key in responseDetail.response.header) {
        if (key.toLowerCase() === "content-type" && responseDetail.response.header[key].toLowerCase().toLowerCase().indexOf("text/html") !== -1) {
            if (!responseDetail.response.header[key].toLowerCase().endsWith("charset=utf-8")) {
                if (!responseDetail.response.header[key].toLowerCase().includes("charset")) {
                    responseDetail.response.header[key] = responseDetail.response.header[key] + ";charset=UTF-8";
                }
            }
            return true;
        }
    }
    return false;
}

// HTML中可能会夹带script标签，里面的JS代码也要能Hook到
function processHtmlResponse(requestDetail, responseDetail) {
    // 使用了这个库来解析HTML  https://github.com/chishui/JSSoup
    // 上面那个库有bug，替换为这个库： https://github.com/cheeriojs/cheerio/

    // 对所有的内嵌JavaScript内容注入Hook
    const body = responseDetail.response.body.toString();

    if (!body.length) {
        return;
    }
    //修复编码问题
    const $ = cheerio.load(body, {decodeEntities: false});
    const scriptArray = $("script", {encodeEntities: false});

    if (!scriptArray?.length) return;

    let alreadyInjectHookContext = false;
    for (let script of scriptArray) {
        // 对于是src引用的外部，其标签内容都会被忽略
        if (script.attribs.src) continue;


        // 空script
        if (!script.children.length) continue;


        // script的内容
        let jsCode = "";
        for (let child of script.children) jsCode += child.data;

        if (!jsCode) return;

        let newJsCode = positioningEncryptionHook(jsCode);
        // 随着script替换时注入，不创建新的script标签
        if (!alreadyInjectHookContext) {
            newJsCode = newJsCode + loadPluginsAsStringWithCache();
            alreadyInjectHookContext = true;
        }

        const newScript = cheerio.load("<script>" + newJsCode + "</script>")("script");
        newScript.attribs = script.attribs;
        $(script).replaceWith(newScript);
    }
    responseDetail.response.body = $.html();
}

/**
 * 判断请求头，请求头里的content-type字段如果包含javascript字样的话则认为是JavaScript字样
 *
 * @param responseDetail
 * @returns {boolean}
 */
function isJavaScriptResponse(responseDetail) {
    for (let key in responseDetail.response.header) {
        if (key.toLowerCase() === "content-type" && responseDetail.response.header[key].toLowerCase().toLowerCase().indexOf("javascript") !== -1) {
            if (!responseDetail.response.header[key].toLowerCase().endsWith("charset=utf-8")) {
                if (!responseDetail.response.header[key].toLowerCase().includes("charset")) {
                    responseDetail.response.header[key] = responseDetail.response.header[key] + ";charset=UTF-8";
                }
            }
            return true;
        }
    }
    return false;
}

function processJavaScriptResponse(requestDetail, responseDetail) {
    // 这样粗暴地搞可能会有问题，比如淘宝那种贼恶心的模块加载方式
    // const url = requestDetail.url.split("?")[0];
    const url = requestDetail.url;
    const body = responseDetail.response.body.toString();

    if (isNeedIgnoreHook(body)) return;


    if (disableCache) {
        processRealtime(responseDetail, url, body);
    } else if (injectSuccessJsFileCache.has(url)) {
        processFromCache(responseDetail, url, body);
    } else {
        processRealtime(responseDetail, url, body);
    }
}

function isNeedIgnoreHook(body) {
    return body.startsWith("{");
}

function processFromCache(responseDetail, url, body) {
    const meta = injectSuccessJsFileCache.get(url);
    const fileContent = fs.readFileSync(meta.filepath).toString();
    responseDetail.response.body = loadPluginsAsStringWithCache() + fileContent;
}

function compressCode(newJsCode, cacheFilePath, meta) {
    try {
        // 调用同步压缩方法
        const result = minify_sync(newJsCode, {
            compress: false,
            mangle: false
        });

        if (result.error) {
            throw result.error;
        }
        if (!disableCache) {
            fs.writeFileSync(cacheFilePath, result.code);
            fs.appendFileSync(injectSuccessJsFileCacheMetaFile, JSON.stringify(meta) + "\n");
        }

        return result.code;
    } catch (error) {
        console.error('压缩过程中发生错误:', error);
    }
}

function processRealtime(responseDetail, url, body) {
    let newJsCode;
    if (config.current_use_plugin === "positioningEncryptionHook") {
        newJsCode = positioningEncryptionHook(body);
    } else if (config.current_use_plugin === "registerFunctionsInWindow") {
        newJsCode = registerFunctionsInWindow(body);
    } else {
        console.log(`[-] 插件名 ${config.current_use_plugin} 不存在,将默认使用 positioningEncryptionHook 插件`);
        newJsCode = positioningEncryptionHook(body);
    }


    const md5 = crypto.createHash("md5");
    const cacheFilePath = injectSuccessJsFileCacheDirectory + "/" + md5.update(url).digest("hex") + ".js";
    const meta = {
        url,
        filepath: cacheFilePath,
        cacheTime: new Date().getTime()
    };

    // 将 newJsCode 进行压缩,防止代码格式化检测
    if (config.is_auto_compress) { // 为True时开启压缩
        let resultForCompressCode = compressCode(newJsCode, cacheFilePath, meta);
        responseDetail.response.body = loadPluginsAsStringWithCache() + resultForCompressCode
    } else {
        if (!disableCache) {
            fs.writeFileSync(cacheFilePath, newJsCode);
            fs.appendFileSync(injectSuccessJsFileCacheMetaFile, JSON.stringify(meta) + "\n");
        }
        responseDetail.response.body = loadPluginsAsStringWithCache() + newJsCode
    }
    injectSuccessJsFileCache.set(url, meta);
}

function ensureDirectoryExists(directory) {
    // 如果指定的目录不存在的话则创建
    if (exists(directory)) {
        return;
    }
    shell.mkdir("-p", directory);
    console.log(`mkdir ${directory}`);
}

function exists(path) {
    try {
        fs.statSync(path);
        return true;
    } catch (e) {
        return e.message.indexOf("no such file or directory") === -1;
    }
}

module.exports.process = process;
