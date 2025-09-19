const babel = require('@babel/core');
const traverse = require('@babel/traverse').default;
const t = require('@babel/types');

/**
 * 将JS代码中的所有函数注册到window对象上，并添加随机后缀避免命名冲突
 * @param {string} code - JavaScript代码字符串
 * @returns {string} 修改后的JavaScript代码字符串
 */
function registerFunctionsInWindow(code) {
    // 生成随机字符串的方法，来自B代码的优点
    function randomString(len = 6) {
        return Math.random().toString(36).substring(2, 2 + len);
    }

    // 按行分割代码，便于错误提示时显示对应行源码
    const codeLines = code.split('\n');
    // 收集所有注册到window的变量名
    // const windowVars = [];

    try {
        // 解析代码生成AST
        const ast = babel.parse(code, {
            sourceType: 'module',
            plugins: [
                '@babel/plugin-transform-react-jsx',
                '@babel/plugin-transform-typescript'
            ]
        });

        if (!ast) {
            throw new Error('无法解析代码生成AST');
        }

        const visitor = {
            // 函数声明处理
            FunctionDeclaration(path) {
                // 获取行号信息，便于追踪
                const line = path.node.loc?.start?.line || 0;
                try {
                    const funcName = path.node.id ? path.node.id.name : 'anonymous';
                    // 生成包含行号的window变量名
                    const windowName = `${funcName}_${randomString()}_L${line}`;

                    const registration = t.expressionStatement(
                        t.assignmentExpression(
                            '=',
                            t.memberExpression(
                                t.identifier('window'),
                                t.identifier(windowName)
                            ),
                            t.identifier(funcName)
                        )
                    );

                    path.insertAfter(registration);
                    //windowVars.push(windowName);
                } catch (e) {
                    // 错误处理，显示行号和源码
                    const srcLine = codeLines[line - 1]?.trim() || '[未知源码]';
                    console.log(`[函数声明处理异常] 第${line}行源码：\n\t${srcLine.slice(0, 40)}\n异常信息：${e.message}\n`);
                }
            },

            // 变量声明处理
            VariableDeclaration(path) {
                if (!path.node.declarations || path.node.declarations.length === 0) {
                    return;
                }

                path.node.declarations.forEach((declaration, index) => {
                    // 获取行号信息
                    const line = declaration.loc?.start?.line || path.node.loc?.start?.line || 0;
                    try {
                        if (declaration?.init &&
                            (t.isFunctionExpression(declaration.init) ||
                                t.isArrowFunctionExpression(declaration.init))) {

                            const funcName = declaration.id?.name;
                            if (!funcName) return;

                            // 生成包含行号的window变量名
                            const windowName = `${funcName}_${randomString()}_L${line}`;

                            const registration = t.expressionStatement(
                                t.assignmentExpression(
                                    '=',
                                    t.memberExpression(
                                        t.identifier('window'),
                                        t.identifier(windowName)
                                    ),
                                    t.identifier(funcName)
                                )
                            );

                            if (index === path.node.declarations.length - 1) {
                                path.insertAfter(registration);
                                //windowVars.push(windowName);
                            }
                        }
                    } catch (e) {
                        // 错误处理，显示行号和源码
                        const srcLine = codeLines[line - 1]?.trim() || '[未知源码]';
                        console.log(`[变量声明处理异常] 第${line}行源码：\n\t${srcLine.slice(0, 40)}\n异常信息：${e.message}\n`);
                    }
                });
            },

            // 类方法处理
            ClassDeclaration(path) {
                // 获取行号信息
                const line = path.node.loc?.start?.line || 0;
                try {
                    const className = path.node.id?.name;
                    if (!className) return;

                    const methods = [];

                    if (path.node.body?.body) {
                        path.node.body.body.forEach(member => {
                            // 为每个类方法单独添加错误捕获
                            try {
                                if (t.isClassMethod(member) && member.key.name !== 'constructor') {
                                    const methodName = member.key.name;
                                    // 获取方法所在行号
                                    const methodLine = member.loc?.start?.line || line;
                                    // 生成包含行号的window变量名
                                    const windowName = `${className}_${methodName}_${randomString()}_L${methodLine}`;

                                    const registration = t.expressionStatement(
                                        t.assignmentExpression(
                                            '=',
                                            t.memberExpression(
                                                t.identifier('window'),
                                                t.identifier(windowName)
                                            ),
                                            t.memberExpression(
                                                t.memberExpression(
                                                    t.identifier(className),
                                                    t.identifier('prototype')
                                                ),
                                                t.identifier(methodName)
                                            )
                                        )
                                    );

                                    methods.push(registration);
                                    //windowVars.push(windowName);
                                }
                            } catch (e) {
                                const methodLine = member.loc?.start?.line || line;
                                const srcLine = codeLines[methodLine - 1]?.trim() || '[未知源码]';
                                console.log(`[类方法处理异常] 类${className}的方法${member.key.name || ''}，第${methodLine}行：\n\t${srcLine.slice(0, 40)}\n异常信息：${e.message}\n`);
                            }
                        });
                    }

                    if (methods.length > 0) {
                        path.insertAfter(methods);
                    }
                } catch (e) {
                    // 类声明整体错误处理
                    const srcLine = codeLines[line - 1]?.trim() || '[未知源码]';
                    console.log(`[类声明处理异常] 第${line}行源码：\n\t${srcLine.slice(0, 40)}\n异常信息：${e.message}\n`);
                }
            }
        };

        // 遍历AST
        traverse(ast, visitor);

        // 使用transformFromAstSync转换AST为代码
        const output = babel.transformFromAstSync(ast, code, {
            comments: true,
            compact: false,
            sourceMaps: false
        });

        return output?.code;

    } catch (error) {
        console.log('整体处理错误: ' + error.message);
    }
}

module.exports = { registerFunctionsInWindow };
