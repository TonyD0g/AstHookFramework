(() => {
    // 用于存储Hook到的所有字符串类型的变量
    const stringsDB = window.cc11001100_hook.stringsDB = window.cc11001100_hook.stringsDB || {
        varValueDb: [],
        codeLocationExecuteTimesCount: []
    };
    const {varValueDb, codeLocationExecuteTimesCount} = stringsDB;

    // 从一个比较大的数开始计数，以方便在展示的时候与执行次数做区分，差值过大就不易混淆
    let execOrderCounter = 100000;
    const checkMap = new Map();


    async function storeDataInRedis(name, valueString, type, execOrderCounter, codeLocation) {
        try {
            const response = await fetch('http://localhost:3000/api/store-data', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name,
                    value: valueString,
                    type,
                    execOrder: execOrderCounter,
                    codeLocation
                }),
            });
            await response.json();
        } catch (error) {
        }
    }

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

    const dataQueue = [];
    let isProcessing = false;
    const BATCH_SIZE = 20; // 每批处理的数据量
    const PROCESS_DELAY = 1000; // 延迟处理时间（毫秒）
    async function sendBatchData() {
        if (dataQueue.length === 0 || isProcessing) return;

        isProcessing = true;
        const batch = dataQueue.splice(0, BATCH_SIZE); // 取出一批数据

        try {
            const response = await fetch('http://localhost:3000/api/store-data-batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(batch), // 发送数组格式的批量数据
            });
            await response.json();
        } catch (error) {
            // 3. 失败时重新放回队列（确保数据不丢失）
            dataQueue.unshift(...batch);
        } finally {
            isProcessing = false;
            if (dataQueue.length > 0) {
                setTimeout(sendBatchData, PROCESS_DELAY); // 继续处理下一批
            }
        }
    }

    async function stringPutToDB(name, value, type) {
        if (!value) return;

        let valueString;
        valueString = advancedToString(value);
        if (Object.keys(valueString).length === 0 || valueString === "{}") return;

        // 解决检测控制台又不知如何绕过时，如何使用hook.search的问题（缓存到一个数据库/文件，将所有内容输出）
        // 获取代码位置
        const codeLocation = getCodeLocation();
        execOrderCounter = execOrderCounter++
        let checkMapKey = name + valueString + type + codeLocation;
        if (!checkMap.has(checkMapKey)) {
            varValueDb.push({
                name,
                // TODO Buffer类结构直接运算Hook不到的问题仍然没有解决...
                // 默认情况下把所有变量都toString保存到字符串池子中
                // 有一些参数就是放在Buffer或者什么地方以字节形式存储，当使用到的时候直接与字符串相加toString，
                // 这种情况如果只监控变量赋值就监控不到了，这是不想添加更多监控点的情况下的折中方案...
                // 所以干脆在它还是个buffer的时候就转为字符串
                value: valueString,
                type,
                execOrder: execOrderCounter,
                codeLocation
            });
            checkMap.set(checkMapKey, true);
            dataQueue.push({ name, value: valueString, type, execOrder: execOrderCounter, codeLocation });
            if (!isProcessing) {
                setTimeout(sendBatchData, PROCESS_DELAY);
            }
        }

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