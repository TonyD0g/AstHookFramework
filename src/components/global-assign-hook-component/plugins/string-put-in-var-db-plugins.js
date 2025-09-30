(() => {
    // 用于存储Hook到的所有字符串类型的变量
    const stringsDB = window.cc11001100_hook.stringsDB = window.cc11001100_hook.stringsDB || {
        varValueDb: [],
        codeLocationExecuteTimesCount: []
    };
    const {varValueDb, codeLocationExecuteTimesCount} = stringsDB;

    // 从一个比较大的数开始计数，以方便在展示的时候与执行次数做区分，差值过大就不易混淆
    let execOrderCounter = 100000;

    function advancedToString(value) {
        if (value === null || value === undefined) {
            return '';
        }
        if (Array.isArray(value)) {
            return value.join(','); // 自定义数组格式
        }
        if (typeof value === 'object') {
            try{
                return JSON.stringify(value); // 对象转为JSON
            }catch (error){
                return "";
            }
        }

        return String(value);
    }

    async function stringPutToDB(name, value, type) {
        if (!value) return;

        let valueString = advancedToString(value);
        if (Object.keys(valueString).length === 0 || valueString === "{}") return;

        // 解决检测控制台又不知如何绕过时，如何使用hook.search的问题（缓存到一个数据库/文件，将所有内容输出）
        const codeLocation = getCodeLocation();
        execOrderCounter = execOrderCounter++
        varValueDb.push({
            name,
            value: valueString,
            type,
            execOrder: execOrderCounter,
            codeLocation
        });

        // 这个地方被执行的次数统计
        if (codeLocation in codeLocationExecuteTimesCount) {
            codeLocationExecuteTimesCount[codeLocation]++;
        } else {
            codeLocationExecuteTimesCount[codeLocation] = 1;
        }

    }

    function getCodeLocation() {
        const callstack = new Error().stack.split("\n");
        while (callstack.length > 0 && callstack[0].indexOf("cc11001100") === -1) {
            callstack.shift();
        }
        if (callstack.length < 2) {
            return null;
        }
        callstack.shift();
        return callstack.shift();
    }

    // 添加Hook回调
    window.cc11001100_hook.hookCallback.push(stringPutToDB);

})();