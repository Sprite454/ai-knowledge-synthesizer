import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

async function testKimi() {
    const key = process.env.KIMI_API_KEY || 'sk-xxxx'; // Replace with a real key if I could, or use the one from .env

    // I will read KIMI_API_KEY from .env
    const envPath = path.resolve('.env');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/KIMI_API_KEY="([^"]+)"/);
    const apiKey = match ? match[1] : '';

    if (!apiKey) {
        console.log('No KIMI_API_KEY found');
        return;
    }

    // A tiny 1x1 pixel base64 image
    const base64Img = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    const url = `data:image/png;base64,${base64Img}`;

    const body = {
        model: "moonshot-v1-8k-vision-preview",
        messages: [
            {
                role: "user",
                content: [
                    { type: "text", text: "Describe this image" },
                    { type: "image_url", image_url: { url } }
                ]
            }
        ]
    };

    const res = await fetch('https://api.moonshot.cn/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });

    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
}

testKimi();
