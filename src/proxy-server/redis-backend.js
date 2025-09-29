const express = require('express');
const redis = require('redis');
const cors = require('cors');

const app = express();
// 允许解析 JSON 格式的请求体
app.use(express.json());
app.use(cors()); // 这将允许所有跨域请求。在生产环境中，你应该配置更严格的策略。

// 创建 Redis 客户端并连接本地 Redis 服务器 (默认端口 6379)
const redisClient = redis.createClient();
redisClient.on('error', (err) => console.log('Redis Client Error', err));
redisClient.connect().then(() => {
    console.log('Connected to Redis');
    // 清空当前Redis数据库
    return redisClient.flushDb();
})
    .then(() => {
        console.log('Redis database flushed successfully on startup');
        console.log("Data needs to wait for at least 60 seconds between each other")
        // 在此之后设置你的路由和启动服务器
        setupRoutesAndStartServer();
    })
    .catch((err) => {
        console.error('Failed to connect to Redis or flush database:', err);
    });

const checkMap = new Map();

function setupRoutesAndStartServer() {
    app.post('/api/store-data-batch', async (req, res) => {
        try {
            const dataArray = req.body;

            if (!Array.isArray(dataArray)) {
                return res.status(400).json({error: 'Request body must be an array'});
            }

            const results = {
                stored: 0,
                errors: 0
            };

            for (const item of dataArray) {
                const { name, value, type, execOrderCounter, codeLocation } = item;

                // 加强数据验证
                if (!name || value === undefined || typeof name !== 'string') {
                    results.errors++;
                    continue;
                }

                const dataToStore = {
                    name,
                    value,
                    type,
                    execOrder: execOrderCounter,
                    codeLocation
                };

                // 强制转换为字符串
                const redisValue = String(JSON.stringify(dataToStore));
                let checkMapKey = name + value + type + codeLocation;

                if (checkMap.has(checkMapKey)) continue;

                console.log(`${redisValue}` + "\n");

                try {
                    // 使用 set 命令并明确指定类型
                    await redisClient.set(name, redisValue);
                    checkMap.set(checkMapKey, true);
                    results.stored++;
                } catch (err) {
                    console.error(`Failed to store key: ${name}`, err);
                    results.errors++;
                }
            }

            res.json({
                message: `Batch storage completed`,
                ...results
            });

        } catch (err) {
            console.error('Batch storage error:', err);
            res.status(500).json({error: 'Failed to store batch data in Redis'});
        }
    });

    // 设置一个路由，让前端通过此 API 存储数据到 Redis
    app.post('/api/store-data', async (req, res) => {
        const {name, value, type, execOrderCounter, codeLocation} = req.body;
        try {
            const dataToStore = {
                name,
                value: value, // 使用前端传来的value
                type,
                execOrder: execOrderCounter,
                codeLocation
            };

            const redisValue = JSON.stringify(dataToStore); // 序列化为JSON字符串
            let checkMapKey = name + value + type + codeLocation;
            // 如果发现重复数据，发送响应后立即 return
            if (checkMap.has(checkMapKey)) return res.json({message: `Duplicate data has been automatically removed: ${name}`});

            checkMap.set(checkMapKey, true);
            await redisClient.set(name, redisValue);
            console.log(`${redisValue}` + "\n");
            res.json({message: `Data stored with key: ${name}`});
        } catch (err) {
            res.status(500).json({error: 'Failed to store data in Redis'});
        }
    });

// 设置一个路由，让前端通过此 API 从 Redis 读取数据
    app.get('/api/get-data/:key', async (req, res) => {
        const {key} = req.params;
        try {
            const value = await redisClient.get(key);
            if (value === null) {
                return res.status(404).json({error: 'Key not found'});
            }
            res.json({key, value});
        } catch (err) {
            res.status(500).json({error: 'Failed to retrieve data from Redis'});
        }
    });

// 启动服务器，监听端口 3000
    const PORT = 3000;
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

