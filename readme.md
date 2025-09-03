# AST-Hook-Framework

## 原理

1. 通过 AnyProxy 获取原JS，并通过AST修改之

2. 替换原JS，浏览器将执行魔改后的JS代码，从而实现特殊效果



## 特性

- [原项目](https://github.com/JSREI/ast-hook-for-js-RE?tab=readme-ov-file) Bug fix [√]
- 引入JS压缩，防止代码格式化检测 [√]
- 吸收其他魔改项目的精髓  [todo]
- 支持挂上代理，从而可以通过抓包软件(burp/yakit/Fiddler等)观察到请求、绕过控制台检测  [todo]
- 支持选择性开启JS压缩  [todo]
- 支持选择性对特定URL进行AST Hook  [todo]



## 感谢

- 原项目：https://github.com/JSREI/ast-hook-for-js-RE?tab=readme-ov-file
- 魔改一：https://github.com/lgnorant-lu/AST-Hook-for-JS-RE-Personnal-Use
- 魔改二：https://github.com/afeichuanqi/ast-hook-new

