# AST-Hook-Framework

## 原理

1. 通过 AnyProxy 获取原JS，并通过AST修改之

2. 替换原JS，浏览器将执行魔改后的JS代码，从而实现特殊效果



## 目前支持的插件

- 快速定位到**加密参数**的**加密位置**



## 使用

1. 下载源码

2. 配置 config 文件 (目录下的 config.json)

   ```json
   {
     "port": 10086,  // 从指定的端口获取数据包来源
     "web_port": 8002, // web服务的端口
     "is_close_detailedLog": true, // 是否关闭详细日志
     "is_open_websocket": false, // 是否开启 websocket
     "is_auto_compress": true, // 是否自动压缩hook后的js代码
     "is_open_hook_target": true, // 是否开启`基于指定逻辑的hook`
     "supported_plugin_list": [ // 支持的插件
       "positioningEncryptionHook", // 定位加密
       "registerFunctionsToWindow" // 注册所有方法到window
     ],
     "current_use_plugin": "positioningEncryptionHook", // 当前正在使用的插件
     "hook_target_supported_types": [
       "url",
       "regex",
       "domain"
     ],// `基于指定逻辑的hook`所支持的type类型
     "hook_target": [
       {
         "type": "domain", // 指定的类型,允许的类型范围在`hook_target_supported_types`
         "value": "baidu.com" // 对应的值,比如说 baidu.com
       }
     ]
   }
   ```

   

3. 开启 AnyProxy：

   ```md
   cd /src/api-server
   node api-server.js
   
   cd /src/proxy-server
   node proxy-server.js
   ```

4. 如果使用默认的 config.json 配置，那么当浏览器的数据包通过 **10086** 端口时，程序会获取到该端口上的所有数据包，并自动Hook

   

## 特性

- [原项目](https://github.com/JSREI/ast-hook-for-js-RE?tab=readme-ov-file) Bug fix [√]

- 引入JS压缩，防止代码格式化检测 [√]

- 支持选择性开启JS压缩  [√]

- 支持选择性对 **特定URL/符合正则/domain** 的URL进行AST Hook，从而加快页面加载速度 [√]

- 加载并读取Config文件，从而达到控制程序流程的目的  [√]

  

## TODO

- 支持用户自定义加载hook插件 [todo]
- 吸收其他魔改项目的精髓  [todo]



## 感谢

- 原项目：https://github.com/JSREI/ast-hook-for-js-RE?tab=readme-ov-file
- 魔改一：https://github.com/lgnorant-lu/AST-Hook-for-JS-RE-Personnal-Use
- 魔改二：https://github.com/afeichuanqi/ast-hook-new

