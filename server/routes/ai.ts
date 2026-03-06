import { Router, Request, Response } from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import OpenAI from 'openai';

// 移除 Markdown CodeBlock 包裹，确保 JSON.parse 成功
function cleanJson(str: string): string {
    let clean = str.trim();
    if (clean.startsWith('```json')) {
        clean = clean.substring(7);
    } else if (clean.startsWith('```')) {
        clean = clean.substring(3);
    }
    if (clean.endsWith('```')) {
        clean = clean.substring(0, clean.length - 3);
    }
    return clean.trim();
}

dotenv.config();

const router = Router();
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

// 初始化 Moonshot (Kimi) 使用 OpenAI 兼容标准库
let moonshot: any;
try {
    if (process.env.KIMI_API_KEY) {
        moonshot = new OpenAI({
            apiKey: process.env.KIMI_API_KEY,
            baseURL: "https://api.moonshot.cn/v1",
        });
    }
} catch (e) {
    console.error('Failed to initialize Moonshot Kimi:', e);
}

async function askDeepSeek(
    systemPrompt: string,
    userPrompt: string,
    responseFormat: 'json' | 'text' = 'text'
) {
    const key = process.env.DEEPSEEK_API_KEY;
    if (!key) throw new Error("缺少配置: 请在 .env 文件中配置 DEEPSEEK_API_KEY");

    const messages = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: userPrompt });

    const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({
            model: 'deepseek-chat',
            messages,
            response_format: responseFormat === 'json' ? { type: "json_object" } : { type: "text" },
            temperature: 0.7
        })
    });

    if (!response.ok) {
        throw new Error(`DeepSeek API Error: ${await response.text()}`);
    }
    const data: any = await response.json();
    return data.choices[0].message.content || '';
}

async function askKimi(
    systemPrompt: string,
    userPrompt: string,
    images?: string[]
) {
    if (!moonshot) throw new Error("Moonshot (Kimi) 未配置，请在 .env 文件中设置 KIMI_API_KEY");

    let content: any = userPrompt;
    let modelName = "moonshot-v1-auto"; // 默认模型

    if (images && images.length > 0) {
        modelName = "moonshot-v1-8k-vision-preview"; // 必须使用支持 vision 的模型
        content = [{ type: "text", text: userPrompt }];
        images.forEach(img => {
            let url = img;
            if (!url.startsWith('data:')) url = `data:image/jpeg;base64,${url}`;
            content.push({ type: "image_url", image_url: { url } });
        });
    }

    const completion: any = await moonshot.chat.completions.create({
        model: modelName,
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content }
        ],
        temperature: 0.3,
    });
    return completion.choices[0].message.content || '';
}

// ---- Kimi OCR 视觉提取工具函数 (专为 DeepSeek 服务) ----
async function performOCR(images: string[], textContext: string): Promise<string> {
    if (!images || images.length === 0) return '';
    console.log(`[AI] 开始使用 Kimi Vision 对 ${images.length} 张图片进行先期视觉阅读...`);
    try {
        const textPrompt = "作为一个顶尖分析师，请详细阅读并描述以下图片中的所有信息。如果有文字请全部提取出来（OCR）。如果有复杂的图表请解释它的含义。请尽可能输出最详细的文本说明，这些描述将帮助另一个大语言模型进行进一步的知识合成。参考上下文是：" + textContext;

        const ocrText = await askKimi("你是一个强大的视觉分析助手。", textPrompt, images);

        console.log(`[AI] OCR 完成，提取文本长度: ${ocrText.length}`);
        return `\n\n--- [内置 Kimi 视觉提取引擎解读图像产生的数据] ---\n${ocrText}\n--- [图像数据结束] ---\n\n`;
    } catch (error) {
        console.error('OCR 提取失败 (Kimi fallback):', error);
        return '\n\n*(注意：系统尝试读取附加的图片，但在视觉识别阶段遇到了故障)*\n\n';
    }
}

// =============================================
// POST /api/v1/ai/synthesize — 知识合成
// =============================================
router.post('/synthesize', async (req: Request, res: Response) => {
    try {
        const { text, images, language, existingTitles, existingCategories, isVideo, forcedType, provider } = req.body;

        const isDeepSeek = provider === 'deepseek';
        const isKimi = provider === 'kimi';

        let finalText = text || '';
        // 只有 DeepSeek 需要双擎 OCR，Kimi 原生支持读图
        if (isDeepSeek && images && images.length > 0) {
            const ocrResult = await performOCR(images, text);
            finalText = finalText + ocrResult;
        }

        const model = 'gemini-2.5-flash';
        const langInstruction = language === 'zh'
            ? 'Output the content in Simplified Chinese.'
            : 'Output the content in English.';

        const videoInstruction = isVideo
            ? "This is content from a video page. 1. Try to extract the core theme, summary, and any visible subtitles or comments. 2. If information is insufficient, logically deduce from the title and description, and mark as 'Generated based on description'. 3. **CRITICAL**: Extract key timestamps in [MM:SS] format. 4. Automatically add '#Video' or '#视频笔记' to the 'tags' array."
            : '';

        const isLongText = finalText.length > 10000;
        const longTextInstruction = isLongText
            ? '**IMPORTANT**: This is a very long document. Please extract the core outline and key conclusions.'
            : '';

        let lensInstruction = '';
        if (forcedType) {
            lensInstruction = `**FORCED LENS**: You must analyze this content as a "${forcedType}".`;
        } else {
            lensInstruction = '**AUTO-DETECT LENS**: First, analyze the content style and determine its type.';
        }

        const prompt = `
      Analyze the provided content.
      ${videoInstruction}
      ${longTextInstruction}
      ${lensInstruction}
      Structure the knowledge into a "Master-Detail" format.
      ${langInstruction}
      
      Output JSON with the following fields:
      - title: A catchy, concise title.
      - mainEntity: The specific core entity/subject.
      - contentType: The detected or forced content type.
      - coreConcept: A summary of the core idea in under 30 words.
      - index: An array of 3-5 short, punchy sentences.
      - fullMarkdown: A HIGHLY DETAILED, long-form article in Markdown format.
        **Strict Formatting Rules:**
        1. **TL;DR Block**: Start with a blockquote summarizing the core insight.
        2. **Emoji Anchors**: Every H2 and H3 header MUST start with a relevant emoji.
        3. **Forced Tables**: Use Markdown tables for ANY comparison.
        4. **Detail**: Include bold text for emphasis.
      - mindmap: A valid Mermaid.js graph definition string.
      - actionItems: An array of strings. Actionable steps/guides.
      - tags: An array of 3-5 precise keywords.
      - category: Assign to ONE of: ${JSON.stringify(existingCategories || [])}.
      
      **Auto Bi-directional Links**
      Existing titles: ${JSON.stringify(existingTitles || [])}
      Wrap relevant titles in [[double brackets]].

      Text Context:
      "${finalText}"
    `;

        let resultJsonString = '{}';

        if (isDeepSeek || isKimi) {
            const systemPrompt = `CRITICAL: You MUST output ONLY valid JSON matching this exact structure:
{
  "title": "",
  "mainEntity": "",
  "contentType": "",
  "coreConcept": "",
  "index": ["", "", ""],
  "fullMarkdown": "",
  "mindmap": "",
  "actionItems": ["", ""],
  "tags": ["", ""],
  "category": ""
}`;
            if (isDeepSeek) {
                resultJsonString = await askDeepSeek(systemPrompt, prompt, 'json');
            } else {
                resultJsonString = await askKimi(systemPrompt, prompt, images);
            }
        } else {
            const parts: any[] = [{ text: prompt }];
            if (images?.length > 0) {
                images.forEach((base64Data: string) => {
                    let mimeType = 'image/jpeg';
                    let data = base64Data;
                    if (base64Data.includes(',')) {
                        const [header, content] = base64Data.split(',');
                        const mimeMatch = header.match(/:([^;]+);/);
                        if (mimeMatch) mimeType = mimeMatch[1];
                        data = content;
                    }
                    parts.push({ inlineData: { mimeType, data } });
                });
            }

            const response = await ai.models.generateContent({
                model,
                contents: { parts },
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            title: { type: Type.STRING },
                            mainEntity: { type: Type.STRING },
                            contentType: { type: Type.STRING },
                            coreConcept: { type: Type.STRING },
                            index: { type: Type.ARRAY, items: { type: Type.STRING } },
                            fullMarkdown: { type: Type.STRING },
                            mindmap: { type: Type.STRING },
                            actionItems: { type: Type.ARRAY, items: { type: Type.STRING } },
                            tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                            category: { type: Type.STRING },
                        },
                        required: ['title', 'mainEntity', 'contentType', 'coreConcept', 'index', 'fullMarkdown', 'mindmap', 'tags', 'category'],
                    },
                },
            });
            resultJsonString = response.text || '{}';
        }

        const result = JSON.parse(cleanJson(resultJsonString));
        if (result.actionItems) {
            result.actionItems = result.actionItems.map((item: string) => ({ text: item, completed: false }));
        }
        res.json(result);
    } catch (error: any) {
        console.error('AI Synthesize error:', error);
        res.status(500).json({ error: error.message });
    }
});

// =============================================
// POST /api/v1/ai/merge — 知识缝合
// =============================================
router.post('/merge', async (req: Request, res: Response) => {
    try {
        const { cards, language, existingTitles, provider } = req.body;
        const isDeepSeek = provider === 'deepseek';
        const isKimi = provider === 'kimi';
        const model = 'gemini-2.5-flash';
        const langInstruction = language === 'zh'
            ? 'Output the content in Simplified Chinese.'
            : 'Output the content in English.';

        const cardsJson = JSON.stringify(cards.map((c: any) => ({
            id: c.id, title: c.title, mainEntity: c.mainEntity,
            coreConcept: c.coreConcept,
            fullMarkdown: c.fullMarkdown || c.details?.join('\n'),
            actionItems: c.actionItems?.map((a: any) => a.text) || [],
            category: c.category, tags: c.tags,
        })));

        const prompt = `
      Analyze the following knowledge cards.
      Identify cards that discuss the SAME 'mainEntity' or are HIGHLY semantically related.
      Merge them into comprehensive "Master-Detail" cards.
      ${langInstruction}

      Requirements:
      1. Create a new title.
      2. Synthesize a new core concept.
      3. Create a new 'index' (3-5 summary points).
      4. Write a new 'fullMarkdown' article that combines ALL details.
      5. Generate a 'mindmap' (Mermaid.js).
      6. Merge action items.
      7. Generate new tags.
      8. Keep the most relevant category.
      9. Specify 'mergedFromIds' or 'originalId'.

      **Auto Bi-directional Links**
      Existing titles: ${JSON.stringify(existingTitles || [])}
      Wrap relevant titles in [[double brackets]].

      Input Cards: ${cardsJson}
    `;

        let resultJsonString = '[]';

        if (isDeepSeek || isKimi) {
            const dsPrompt = prompt + `
            
CRITICAL: You MUST output ONLY a valid JSON ARRAY of objects matching this exact structure:
[{
    "mergedFromIds": ["id1", "id2"],
    "originalId": "opt",
    "title": "",
    "mainEntity": "",
    "coreConcept": "",
    "index": ["", ""],
    "fullMarkdown": "",
    "mindmap": "",
    "actionItems": ["", ""],
    "tags": ["", ""],
    "category": ""
}]`;
            if (isDeepSeek) {
                resultJsonString = await askDeepSeek('', dsPrompt, 'json');
            } else {
                resultJsonString = await askKimi('', dsPrompt);
            }
        } else {
            const response = await ai.models.generateContent({
                model,
                contents: prompt + "\nOutput a JSON ARRAY of objects.",
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                mergedFromIds: { type: Type.ARRAY, items: { type: Type.STRING } },
                                originalId: { type: Type.STRING },
                                title: { type: Type.STRING },
                                mainEntity: { type: Type.STRING },
                                coreConcept: { type: Type.STRING },
                                index: { type: Type.ARRAY, items: { type: Type.STRING } },
                                fullMarkdown: { type: Type.STRING },
                                mindmap: { type: Type.STRING },
                                actionItems: { type: Type.ARRAY, items: { type: Type.STRING } },
                                tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                                category: { type: Type.STRING },
                            },
                            required: ['title', 'coreConcept', 'index', 'fullMarkdown', 'mindmap', 'tags', 'category'],
                        },
                    },
                },
            });
            resultJsonString = response.text || '[]';
        }

        const result = JSON.parse(cleanJson(resultJsonString));
        res.json(result);
    } catch (error: any) {
        console.error('AI Merge error:', error);
        res.status(500).json({ error: error.message });
    }
});

// =============================================
// POST /api/v1/ai/chat — AI 对话
// =============================================
router.post('/chat', async (req: Request, res: Response) => {
    try {
        const { messages, context, language, enableSearch, provider } = req.body;
        const isDeepSeek = provider === 'deepseek';
        const isKimi = provider === 'kimi';
        const model = 'gemini-2.5-flash';
        const langInstruction = language === 'zh' ? 'Output in Simplified Chinese.' : 'Output in English.';

        const systemPrompt = language === 'zh'
            ? `你是一个博学的知识导师。用户正在学习一份特定的笔记（Context）。
优先基于 Context 回答，确保准确。
如果用户的问题超出了 Context 范围，请使用你的通用知识库进行回答。
关键要求：在回答时，请明确区分来源。如果是卡片里的内容，标注 [来源: 笔记]；如果是你扩展的知识，标注 [AI 扩展]。
${enableSearch && !isDeepSeek ? '用户要求联网搜索最新信息。' : ''}

在回答的最后，请根据当前话题，生成 3 个追问问题，以 JSON 数组格式返回。
...回答内容...
\`\`\`json
["问题1", "问题2", "问题3"]
\`\`\``
            : `You are a knowledgeable tutor. The user is studying a specific note (Context).
Prioritize answering based on the Context.
Key Requirement: Clearly distinguish the source with [Source: Note] or [AI Extension].
${enableSearch && !isDeepSeek ? 'The user requests internet search for the latest information.' : ''}

At the end, generate 3 follow-up questions as a JSON array.
...Answer content...
\`\`\`json
["Question 1", "Question 2", "Question 3"]
\`\`\``;

        let text = '';
        let suggestedQuestions: string[] = [];

        if (isDeepSeek || isKimi) {
            const userHistory = `Context:\n${context}\n\nChat History:\n${messages.map((m: any) => `${m.role}: ${m.content}`).join('\n')}\n${langInstruction}`;
            if (isDeepSeek) {
                text = await askDeepSeek(systemPrompt, userHistory, 'text');
            } else {
                text = await askKimi(systemPrompt, userHistory);
            }
        } else {
            const fullPrompt = `${systemPrompt}\n\n${langInstruction}\n\nContext:\n${context}\n\nChat History:\n${messages.map((m: any) => `${m.role}: ${m.content}`).join('\n')}`;

            const config: any = {};
            if (enableSearch) {
                config.tools = [{ googleSearch: {} }];
            }

            const response = await ai.models.generateContent({
                model,
                contents: fullPrompt,
                config,
            });
            text = response.text || '';
        }

        const jsonMatch = text.match(/```json\s*(\[[\s\S]*?\])\s*```/);
        if (jsonMatch) {
            try {
                suggestedQuestions = JSON.parse(jsonMatch[1]);
                text = text.replace(jsonMatch[0], '').trim();
            } catch (e) { /* ignore */ }
        }

        res.json({ content: text, suggestedQuestions });
    } catch (error: any) {
        console.error('AI Chat error:', error);
        res.status(500).json({ error: error.message });
    }
});

// =============================================
// POST /api/v1/ai/deep-dive — 深度研究
// =============================================
router.post('/deep-dive', async (req: Request, res: Response) => {
    try {
        const { card, language, provider } = req.body;
        const isDeepSeek = provider === 'deepseek';
        const isKimi = provider === 'kimi';
        const model = 'gemini-2.5-flash';
        const langInstruction = language === 'zh' ? 'Write the report in Simplified Chinese.' : 'Write the report in English.';

        const prompt = `
      Conduct a "Deep Dive" research on the following topic.
      Topic: ${card.title}
      Core Concept: ${card.coreConcept}
      Context Tags: ${card.tags?.join(', ')}
      
      ${langInstruction}
      Include: Background & Context, Advanced Insights, Practical Application, Related Trends.
    `;

        let content = '';
        let sources: any[] = [];

        if (isDeepSeek || isKimi) {
            if (isDeepSeek) {
                content = await askDeepSeek('You are an expert researcher.', prompt, 'text');
            } else {
                content = await askKimi('You are an expert researcher.', prompt);
            }
            // DeepSeek/Kimi API without search doesn't return grounding chunks
        } else {
            const response = await ai.models.generateContent({
                model,
                contents: prompt,
                config: { tools: [{ googleSearch: {} }] },
            });

            content = response.text || 'No content generated.';
            sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
                ?.map((chunk: any) => chunk.web ? { title: chunk.web.title, uri: chunk.web.uri } : null)
                .filter(Boolean) || [];
        }

        res.json({ content, sources });
    } catch (error: any) {
        console.error('AI Deep Dive error:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
