import FormData from 'form-data';
import fs from 'fs';
import fetch from 'node-fetch';

async function testFiles() {
    try {
        const form = new FormData();
        form.append('file', Buffer.from('Hello world'), {
            filename: 'test.md',
            contentType: 'text/markdown',
        });
        const res = await fetch('http://localhost:3000/api/v1/files/parse', {
            method: 'POST',
            body: form
        });
        const text = await res.text();
        console.log("Status:", res.status);
        console.log("Response:", text);
    } catch (e) {
        console.error(e);
    }
}
testFiles();
