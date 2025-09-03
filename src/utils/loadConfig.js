import { promises as fs } from 'fs';

export async function loadConfig() {
    try {
        const data = await fs.readFile('../../config.json', 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error('读取配置文件失败:', err);
        throw err;
    }
}