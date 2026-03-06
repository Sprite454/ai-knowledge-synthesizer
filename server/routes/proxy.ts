import express from 'express';
import fetch from 'node-fetch';
// @ts-ignore
import * as puppeteerObj from 'puppeteer-extra';
const puppeteer: any = (puppeteerObj as any).default || puppeteerObj;
// @ts-ignore
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
// @ts-ignore
import * as TurndownObj from 'turndown';
const TurndownService: any = (TurndownObj as any).default || TurndownObj;

puppeteer.use(StealthPlugin());

const router = express.Router();
const turndownService = new TurndownService({ headingStyle: 'atx' });

// 飞书 Webhook 代理
router.post('/feishu', async (req, res) => {
    try {
        const { webhookUrl, payload } = req.body;
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const text = await response.text();
        res.status(response.status).send(text);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// 需要强渲染的域名判断
const isStrictAntiCrawler = (url: string) => {
    const strictDomains = ['zhihu.com', 'mp.weixin.qq.com', 'xiaohongshu.com', 'douyin.com'];
    return strictDomains.some(domain => url.includes(domain));
};

async function fetchWithPuppeteer(url: string) {
    console.log(`[Proxy] 使用 Puppeteer 渲染页面: ${url}`);

    const browser = await puppeteer.launch({
        headless: true,
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--window-size=1920,1080'
        ]
    });

    try {
        const page = await browser.newPage();
        // 随机且真实的移动端/桌面端指纹
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1920, height: 1080 });
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
        });



        try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        } catch (navError) {
            console.log(`[Proxy] Puppeteer goto 发生导航超时或异常，将尝试直接读取现有 DOM:`, navError.message);
        }

        // 模拟真人停留滚动，让懒加载的 DOM 加载（尤其针对小红书/知乎）
        await new Promise(r => setTimeout(r, 2500));
        await page.evaluate(() => window.scrollTo(0, 500));
        await new Promise(r => setTimeout(r, 1000));

        // 提取主要内容
        let contentHtml = await page.evaluate(() => {
            // 尝试移除常见的干扰元素
            const selectorsToRemove = ['nav', 'header', 'footer', '.sidebar', '#comments', '.ad', '.advertisement'];
            selectorsToRemove.forEach(selector => {
                document.querySelectorAll(selector).forEach(el => el.remove());
            });

            const article =
                document.querySelector('.RichText') || // 知乎
                document.querySelector('.note-content') || // 小红书 (优先)
                document.querySelector('#detail-title') || // 小红书标题备用
                document.querySelector('#js_content') || // 微信
                document.querySelector('article') ||
                document.body;

            // 构建最终 DOM 序列化
            let finalHtml = '';

            // 小红书经常标题和内容分离
            const titleEl = document.querySelector('#detail-title') || document.querySelector('.title');
            if (titleEl && article !== titleEl) {
                finalHtml += `<h1>${titleEl.textContent}</h1>\n`;
            }
            finalHtml += article.innerHTML;

            return finalHtml;
        });

        const markdownText = turndownService.turndown(contentHtml);
        return markdownText;
    } finally {
        await browser.close();
    }
}

// Jina Reader / Puppeteer 混合代理
router.post('/reader', async (req, res) => {
    try {
        const { url } = req.body;

        if (!url) {
            return res.status(400).json({ error: "URL is required" });
        }

        // 策略 1：如果检测为严格反爬站点，直接走 Puppeteer
        if (isStrictAntiCrawler(url)) {
            const content = await fetchWithPuppeteer(url);
            return res.json({ content });
        }

        // 策略 2：默认走 Jina Reader
        console.log(`[Proxy] 使用 Jina Reader 获取: ${url}`);
        let response = await fetch(`https://r.jina.ai/${url}`, {
            headers: {
                // 'Authorization': `Bearer ${process.env.JINA_API_KEY}` // 可选
                'Accept': 'text/plain'
            }
        });

        let text = await response.text();

        // 如果 Jina Reader 返回被拦截或内容过短，降级到 Puppeteer
        if (!response.ok || text.length < 200 || text.includes('captcha') || text.includes('security check')) {
            console.log(`[Proxy] Jina Reader 获取异常 (${response.status})，降级使用 Puppeteer...`);
            text = await fetchWithPuppeteer(url);
        }

        res.json({ content: text });
    } catch (error: any) {
        console.error('[Proxy] 解析失败:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
