import puppeteer from 'puppeteer-extra';
// @ts-ignore
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
puppeteer.use(StealthPlugin());

async function testXYSL() {
    console.log('启动 Chrome...');
    const url = 'https://www.xiaohongshu.com/explore/69a7e1e4000000000e00f032?xsec_token=ABlU5taA_sugiRoJZo-UBzwPHSBCT5w2UoxqcKg6nURx4=&xsec_source=pc_feed&m_source=mengfanwetab';
    const browser = await puppeteer.launch({
        headless: true,
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled', '--window-size=1920,1080']
    });

    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
        console.log('访问目标 URL...', url);
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        console.log('跳转完成。获取标题...');
        const title = await page.title();
        console.log('标题:', title);

        const content = await page.evaluate(() => document.body.innerText);
        console.log('内容片段:', content.substring(0, 200).replace(/\n/g, ' '));

    } catch (e) {
        console.error('Puppeteer 抓取异常:', e.message);
    } finally {
        await browser.close();
        console.log('完成。');
    }
}
testXYSL();
