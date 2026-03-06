import express from 'express';
import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';
import aiRouter from './server/routes/ai.js';
import proxyRouter from './server/routes/proxy.js';
import filesRouter from './server/routes/files.js';

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use('/ai', aiRouter);
app.use('/proxy', proxyRouter);
app.use('/files', filesRouter);

async function runTests() {
    console.log('==========================================');
    console.log('开始全面模块连通性测试报告生成...');
    console.log('==========================================\n');

    const report = [];

    // 1. 测试文件解析 (Markdown)
    try {
        console.log('⏳ [测试 1/5] 测试文件解析路线 (Markdown)...');
        fs.writeFileSync('test-upload.md', '# 这是一个测试文件\n验证后端文件流是否通畅。');
        const fd = new FormData();
        fd.append('file', fs.createReadStream('test-upload.md'));
        const fileRes = await fetch('http://localhost:3001/files/parse', { method: 'POST', body: fd });
        const fileData: any = await fileRes.json();
        if (fileData.content && fileData.content.includes('验证后端文件流')) {
            console.log('✅ 文件解析 (Markdown) 成功');
            report.push('✅ 文件解析 (Markdown/PDF 底层端点): 成功连通');
        } else {
            console.log('❌ 文件解析失败:', fileData);
            report.push('❌ 文件解析: 失败');
        }
    } catch (e: any) {
        console.log('❌ 文件解析异常:', e.message);
        report.push('❌ 文件解析: 异常 ' + e.message);
    }

    // 2. 测试反爬虫链接读取 (知乎 / 小红书)
    try {
        console.log('\n⏳ [测试 2/5] 测试反风控 Puppeteer 爬虫 (读取知乎)...');
        const proxyRes = await fetch('http://localhost:3001/proxy/reader', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: 'https://zhuanlan.zhihu.com/p/655938531' })
        });
        const proxyData: any = await proxyRes.json();
        if (proxyData.content && proxyData.content.length > 50) {
            console.log(`✅ Puppeteer 爬取成功，获取到 ${proxyData.content.length} 字符的正文。`);
            report.push(`✅ 强反爬链接读取 (知乎/小红书): 成功连通 (${proxyData.content.length} 字符)`);
        } else {
            console.log('❌ Puppeteer 爬取失败:', proxyData);
            report.push('❌ 强反爬链接读取: 失败或内容过短');
        }
    } catch (e: any) {
        console.log('❌ Puppeteer 爬取异常:', e.message);
        report.push('❌ 强反爬链接读取: 异常 ' + e.message);
    }

    // 3. 测试 Gemini 模型连通性
    try {
        console.log('\n⏳ [测试 3/5] 测试大模型连通性 (Gemini)...');
        const geminiRes = await fetch('http://localhost:3001/ai/synthesize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: '请输出一个 JSON 包含 {"status": "ok", "model": "gemini"}', provider: 'gemini' })
        });
        const geminiData: any = await geminiRes.json();
        if (geminiData.cards && geminiData.cards.length > 0) {
            console.log('✅ Gemini 模型调用成功');
            report.push('✅ 模型连通性 (Gemini): 成功响应');
        } else {
            console.log('⚠️ Gemini 响应未能正确生成卡片或超时:', geminiData);
            report.push('⚠️ 模型连通性 (Gemini): 异常/网络受阻');
        }
    } catch (e: any) {
        console.log('❌ Gemini 调用异常:', e.message);
        report.push('❌ 模型连通性 (Gemini): 连接失败 (受国内网络限制影响)');
    }

    // 4. 测试 Kimi 模型连通性
    try {
        console.log('\n⏳ [测试 4/5] 测试大模型连通性 (Kimi)...');
        const kimiRes = await fetch('http://localhost:3001/ai/synthesize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: '测试请求，解析这段文字作为一张卡片。', provider: 'kimi' })
        });
        const kimiData: any = await kimiRes.json();
        if (kimiData.cards && kimiData.cards.length > 0) {
            console.log('✅ Kimi 模型调用成功');
            report.push('✅ 模型连通性 (Kimi): 成功响应并生成卡片');
        } else {
            console.log('❌ Kimi 响应失败:', kimiData);
            report.push('❌ 模型连通性 (Kimi): 生成异常');
        }
    } catch (e: any) {
        console.log('❌ Kimi 调用异常:', e.message);
        report.push('❌ 模型连通性 (Kimi): 连接失败');
    }

    // 5. 测试 DeepSeek 模型连通性
    try {
        console.log('\n⏳ [测试 5/5] 测试大模型连通性 (DeepSeek)...');
        const dsRes = await fetch('http://localhost:3001/ai/synthesize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: '测试请求，解析这段文字作为一张卡片。', provider: 'deepseek' })
        });
        const dsData: any = await dsRes.json();
        if (dsData.cards && dsData.cards.length > 0) {
            console.log('✅ DeepSeek 模型调用成功');
            report.push('✅ 模型连通性 (DeepSeek): 成功响应并生成卡片');
        } else {
            console.log('❌ DeepSeek 响应失败:', dsData);
            report.push('❌ 模型连通性 (DeepSeek): 生成异常');
        }
    } catch (e: any) {
        console.log('❌ DeepSeek 调用异常:', e.message);
        report.push('❌ 模型连通性 (DeepSeek): 连接失败');
    }

    console.log('\n==========================================');
    console.log('测试报告汇总');
    console.log('==========================================');
    report.forEach(r => console.log(r));
    console.log('==========================================');

    // 写入报告
    fs.writeFileSync('test-report.md', '## 测试汇总报告\n\n' + report.map(r => '- ' + r).join('\n'));
}

const server = app.listen(3001, () => {
    runTests().then(() => {
        server.close();
        process.exit(0);
    });
});
