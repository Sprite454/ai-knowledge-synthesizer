import express from 'express';
import aiRouter from './server/routes/ai.js';
import proxyRouter from './server/routes/proxy.js';
import filesRouter from './server/routes/files.js';
import fs from 'fs';

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use('/ai', aiRouter);
app.use('/proxy', proxyRouter);
app.use('/files', filesRouter);

const server = app.listen(3001, async () => {
    console.log('Test server started on 3001\n');
    const report = [];

    // 1. 测试文件解析 (Markdown)
    try {
        console.log('⏳ [测试 1/4] 测试文件解析路线 (Markdown)...');
        fs.writeFileSync('test-upload.md', '# 这是一个测试文件\n验证后端文件流是否通畅。');
        const fd = new FormData();
        const blob = new Blob([fs.readFileSync('test-upload.md')], { type: 'text/markdown' });
        fd.append('file', blob, 'test-upload.md');
        const fileRes = await fetch('http://localhost:3001/files/parse', { method: 'POST', body: fd });
        const fileData = await fileRes.json();
        if (fileData.content && fileData.content.includes('验证后端文件流')) {
            console.log('✅ 文件解析 (Markdown) 成功');
            report.push('✅ 文件解析 (Markdown/PDF 底层端点): 成功连通');
        } else {
            console.log('❌ 文件解析失败:', fileData);
            report.push('❌ 文件解析: 失败');
        }
    } catch (e) {
        console.log('❌ 文件解析异常:', e.message);
        report.push('❌ 文件解析: 异常 ' + e.message);
    }

    // 2. 测试反爬虫链接读取 (知乎)
    try {
        console.log('\n⏳ [测试 2/4] 测试反风控 Puppeteer 爬虫 (读取知乎)...');
        const proxyRes = await fetch('http://localhost:3001/proxy/reader', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: 'https://zhuanlan.zhihu.com/p/655938531' })
        });
        const proxyData = await proxyRes.json();
        if (proxyData.content && proxyData.content.length > 50) {
            console.log(`✅ Puppeteer 爬取成功，获取到 ${proxyData.content.length} 字符的正文。`);
            report.push(`✅ 强反爬链接读取 (知乎/小红书等): 成功连通 (${proxyData.content.length} 字符)`);
        } else {
            console.log('❌ Puppeteer 爬取失败:', proxyData);
            report.push('❌ 强反爬链接读取: 失败或内容过短');
        }
    } catch (e) {
        console.log('❌ Puppeteer 爬取异常:', e.message);
        report.push('❌ 强反爬链接读取: 异常 ' + e.message);
    }

    // 测试模型连通性的 Helper
    async function testModel(providerName, providerKey) {
        try {
            console.log(`\n⏳ [测试大模型] 测试连通性 (${providerName})...`);
            const res = await fetch('http://localhost:3001/ai/synthesize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: '{"role":"user","content":"测试请求，如果收到请回复收到。"}', url: '', provider: providerKey })
            });
            const data = await res.json();
            if (data.cards && data.cards.length > 0) {
                console.log(`✅ ${providerName} 模型调用成功`);
                report.push(`✅ 模型连通性 (${providerName}): 成功响应并生成卡片`);
            } else {
                console.log(`❌ ${providerName} 响应失败:`, data);
                report.push(`❌ 模型连通性 (${providerName}): 生成异常 (${data.error || '未知错误格式'})`);
            }
        } catch (e) {
            console.log(`❌ ${providerName} 调用异常:`, e.message);
            report.push(`❌ 模型连通性 (${providerName}): 连接失败 ` + e.message);
        }
    }

    // 3. 测试几个模型
    await testModel('Gemini (双模引擎)', 'gemini');
    await testModel('Kimi (月之暗面)', 'kimi');
    await testModel('DeepSeek', 'deepseek');

    console.log('\n==========================================');
    console.log('测试报告汇总');
    console.log('==========================================');
    report.forEach(r => console.log(r));
    console.log('==========================================');

    // 写入报告
    fs.writeFileSync('test-report.md', '## 测试汇总报告\n\n' + report.map(r => '- ' + r).join('\n'));

    server.close();
    process.exit(0);
});
