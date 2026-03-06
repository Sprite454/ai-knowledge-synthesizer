import express from 'express';
import * as multerObj from 'multer';
const multer: any = (multerObj as any).default || multerObj;
import * as pdfParseObj from 'pdf-parse';
const pdfParse: any = (pdfParseObj as any).default || pdfParseObj;

const router = express.Router();

// 配置 multer 处理内存中的文件流
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

router.post('/parse', upload.single('file'), async (req, res) => {
    try {
        if (!(req as any).file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const file = (req as any).file;
        const originalName = file.originalname.toLowerCase();
        let extractedText = '';

        console.log(`[Files] 正在解析文件: ${originalName}, 大小: ${(file.size / 1024 / 1024).toFixed(2)} MB`);

        if (originalName.endsWith('.pdf')) {
            // 解析 PDF
            const pdfData = await pdfParse(file.buffer);
            extractedText = pdfData.text;
        } else if (originalName.endsWith('.md') || originalName.endsWith('.txt')) {
            // 直接读取 UTF-8 文本
            extractedText = file.buffer.toString('utf-8');
        } else {
            return res.status(400).json({ error: 'Unsupported file type. Only .pdf, .md, .txt are supported.' });
        }

        if (!extractedText || extractedText.trim() === '') {
            return res.status(422).json({ error: 'Failed to extract text from file or file is empty.' });
        }

        console.log(`[Files] 解析成功，提取文本长度: ${extractedText.length}`);

        // 简单规范化文本格式（移除过多连续换行）
        const normalizedText = extractedText.replace(/\n{3,}/g, '\n\n').trim();

        res.json({ content: normalizedText, filename: file.originalname });
    } catch (error: any) {
        console.error('[Files] 文件解析路由错误:', error);
        res.status(500).json({ error: error.message || 'Error occurred while parsing the file.' });
    }
});

export default router;
