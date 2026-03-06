import fs from 'fs';
async function test() {
    try {
        console.log("Testing POST /api/v1/ai/synthesize...");
        const res = await fetch('http://localhost:3000/api/v1/ai/synthesize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: "如何学习Python？",
                provider: "gemini",
                language: "zh"
            })
        });
        const text = await res.text();
        fs.writeFileSync('test-output.log', `Status: ${res.status}\nResponse: ${text}`);
        console.log("Done");
    } catch (err) {
        fs.writeFileSync('test-output.log', `Error: ${err.message}`);
    }
}
test();
