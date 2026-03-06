import { GoogleGenAI, Type } from "@google/genai";
import { ChatMessage } from "@/types";

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function chatWithAI(
  messages: ChatMessage[],
  context: string,
  language: 'en' | 'zh' = 'en',
  enableSearch: boolean = false
): Promise<{ content: string; suggestedQuestions: string[] }> {
  const model = "gemini-2.5-flash";

  const langInstruction = language === 'zh'
    ? "Output in Simplified Chinese."
    : "Output in English.";

  const systemPrompt = language === 'zh'
    ? `你是一个博学的知识导师。用户正在学习一份特定的笔记（Context）。
优先基于 Context 回答，确保准确。
如果用户的问题超出了 Context 范围，或者需要解释概念、举例、拓展延伸，请使用你的通用知识库进行回答。
关键要求：在回答时，请明确区分来源。如果是卡片里的内容，标注 [来源: 笔记]；如果是你扩展的知识，标注 [AI 扩展]。
${enableSearch ? "用户要求联网搜索最新信息。请忽略知识截止日期，提供最新的互联网数据来回答这个问题。" : ""}

在回答的最后，请根据当前话题，生成 3 个用户可能会感兴趣的深度追问问题，以 JSON 数组格式返回。
格式示例：
...回答内容...
\`\`\`json
["问题1", "问题2", "问题3"]
\`\`\``
    : `You are a knowledgeable tutor. The user is studying a specific note (Context).
Prioritize answering based on the Context to ensure accuracy.
If the user's question goes beyond the Context, or requires concept explanation, examples, or extension, please use your general knowledge to answer.
Key Requirement: Clearly distinguish the source. If it's from the card, mark it as [Source: Note]; if it's your extension, mark it as [AI Extension].
${enableSearch ? "The user requests internet search for the latest information. Please ignore knowledge cutoffs and provide the latest internet data." : ""}

At the end of your answer, generate 3 follow-up questions the user might be interested in, based on the current topic. Return them as a JSON array.
Format Example:
...Answer content...
\`\`\`json
["Question 1", "Question 2", "Question 3"]
\`\`\``;

  const fullPrompt = `${systemPrompt}\n\n${langInstruction}\n\nContext:\n${context}\n\nChat History:\n${messages.map(m => `${m.role}: ${m.content}`).join('\n')}`;

  try {
    const config: any = {};
    if (enableSearch) {
      config.tools = [{ googleSearch: {} }];
    }

    const response = await ai.models.generateContent({
      model,
      contents: fullPrompt,
      config
    });

    let text = response.text || "";
    let suggestedQuestions: string[] = [];

    // Extract JSON array from the end
    const jsonMatch = text.match(/```json\s*(\[[\s\S]*?\])\s*```/);
    if (jsonMatch) {
      try {
        suggestedQuestions = JSON.parse(jsonMatch[1]);
        // Remove the JSON block from the text
        text = text.replace(jsonMatch[0], "").trim();
      } catch (e) {
        console.error("Failed to parse suggested questions JSON", e);
      }
    }

    return { content: text, suggestedQuestions };
  } catch (error) {
    console.error("Chat with AI error:", error);
    throw error;
  }
}

export async function synthesizeKnowledge(
  text: string, 
  images: string[] = [], 
  language: 'en' | 'zh' = 'en', 
  existingTitles: string[] = [], 
  existingCategories: string[] = [],
  isVideo: boolean = false,
  forcedType?: string // New: Content Lens
) {
  const model = "gemini-3-flash-preview"; 

  const langInstruction = language === 'zh' 
    ? "Output the content in Simplified Chinese." 
    : "Output the content in English.";

  const videoInstruction = isVideo 
    ? "This is content from a video page. 1. Try to extract the core theme, summary, and any visible subtitles or comments. 2. If information is insufficient, logically deduce from the title and description, and mark as 'Generated based on description'. 3. **CRITICAL**: Extract key timestamps in [MM:SS] format (e.g., [05:30]) for important sections and include them in the 'fullMarkdown'. 4. Automatically add '#Video' or '#视频笔记' to the 'tags' array." 
    : "";

  const isLongText = text.length > 10000;
  const longTextInstruction = isLongText 
    ? "**IMPORTANT**: This is a very long document. Please extract the core outline and key conclusions. Do not try to summarize everything in detail, but focus on the most critical information."
    : "";

  // Content Lens Logic
  let lensInstruction = "";
  if (forcedType) {
    lensInstruction = `
      **FORCED LENS**: You must analyze this content as a "${forcedType}".
      
      Specific Instructions for "${forcedType}":
      - **Interview (人物访谈)**: Focus on the interviewee's background, extract "Golden Sentences" (quotes), and analyze their personality traits. Use > blockquotes for key quotes.
      - **Tutorial (操作教程)**: Structure the 'fullMarkdown' as a strict Step-by-Step guide. Use checkboxes (- [ ]) for actionable steps. Focus on "How-to".
      - **Research Report (深度研报)**: Focus on data analysis, market trends, and comparisons. You MUST use Markdown tables for data. Predict future trends.
      - **News (新闻资讯)**: Focus on the 5Ws (Who, What, When, Where, Why) and the immediate impact.
      - **Opinion (观点评论)**: Extract the core arguments, supporting evidence, and counter-arguments.
    `;
  } else {
    lensInstruction = `
      **AUTO-DETECT LENS**: First, analyze the content style and determine its type (e.g., Interview, Tutorial, News, Research Report, Opinion, etc.).
      Then, apply the specific instructions for that type as defined above (e.g., if Interview, focus on quotes; if Tutorial, focus on steps).
    `;
  }

  const prompt = `
    Analyze the provided content (text and images).
    ${videoInstruction}
    ${longTextInstruction}
    ${lensInstruction}
    
    Structure the knowledge into a "Master-Detail" format.
    
    ${langInstruction}
    
    Output JSON with the following fields:
    - title: A catchy, concise title.
    - mainEntity: The specific core entity/subject (e.g., "Zeekr 007").
    - contentType: The detected or forced content type (e.g., "Interview", "Tutorial", "News", "Report").
    - coreConcept: A summary of the core idea in under 30 words.
    - index: An array of 3-5 short, punchy sentences summarizing the key points (for the card view).
    - fullMarkdown: A HIGHLY DETAILED, long-form article in Markdown format. 
      **Strict Formatting Rules:**
      1. **TL;DR Block**: Start with a blockquote (> ) summarizing the core insight in under 50 words. Prefix with "💡 Core Insight" or "💡 核心金句".
      2. **Emoji Anchors**: Every H2 (##) and H3 (###) header MUST start with a relevant emoji. Example: "## 💰 Pricing Strategy", "### 🚀 Performance".
      3. **Forced Tables**: Use Markdown tables for ANY comparison (A vs B), parameter lists, or pros/cons analysis. Do NOT use plain lists for these.
      4. **Detail**: Include bold text for emphasis and detailed explanations. Do NOT summarize too much; keep the depth.
      5. **Timestamps**: If this is a video, ensure [MM:SS] timestamps are used at the beginning of key paragraphs or sections.
      6. **Lens Specifics**: Ensure the formatting matches the detected 'contentType' (e.g., checkboxes for Tutorials).
    - mindmap: A valid Mermaid.js graph definition string (e.g., "graph TD; A-->B;") representing the logic structure of the content.
    - actionItems: An array of strings. Actionable steps/guides.
    - tags: An array of 3-5 precise, high-frequency keywords (e.g., "Job Interview", "React", "Productivity"). Avoid generic tags like "Knowledge".
    - category: Analyze the content and assign it to ONE of the following existing categories: ${JSON.stringify(existingCategories)}. 
      If and ONLY IF the content is completely unrelated to any of these, create a new, short category name (max 4 words).
      Prioritize existing categories.

    **IMPORTANT: Auto Bi-directional Links**
    Here is a list of existing card titles in the knowledge base:
    ${JSON.stringify(existingTitles)}
    
    If you mention any of these existing titles or highly relevant core entities in your 'fullMarkdown', you MUST wrap them in double brackets like [[Title]].
    Example: "This concept is related to [[React Hooks]] and [[State Management]]."
    Do this automatically to create a networked knowledge base.

    Text Context:
    "${text}"
  `;

  try {
    const parts: any[] = [{ text: prompt }];

    if (images && images.length > 0) {
      images.forEach(base64Data => {
        let mimeType = "image/jpeg";
        let data = base64Data;
        if (base64Data.includes(",")) {
          const [header, content] = base64Data.split(",");
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
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            mainEntity: { type: Type.STRING },
            contentType: { type: Type.STRING }, // New field
            coreConcept: { type: Type.STRING },
            index: { type: Type.ARRAY, items: { type: Type.STRING } },
            fullMarkdown: { type: Type.STRING },
            mindmap: { type: Type.STRING },
            actionItems: { type: Type.ARRAY, items: { type: Type.STRING } },
            tags: { type: Type.ARRAY, items: { type: Type.STRING } },
            category: { type: Type.STRING }
          },
          required: ["title", "mainEntity", "contentType", "coreConcept", "index", "fullMarkdown", "mindmap", "tags", "category"]
        }
      }
    });

    const result = JSON.parse(response.text || "{}");
    
    if (result.actionItems) {
      result.actionItems = result.actionItems.map((item: string) => ({
        text: item,
        completed: false
      }));
    }

    return result;
  } catch (error) {
    console.error("Error synthesizing knowledge:", error);
    throw error;
  }
}

export async function mergeKnowledgeCards(cards: any[], language: 'en' | 'zh' = 'en', existingTitles: string[] = []) {
  const model = "gemini-3-flash-preview";

  const langInstruction = language === 'zh' 
    ? "Output the content in Simplified Chinese." 
    : "Output the content in English.";

  const cardsJson = JSON.stringify(cards.map(c => ({
    id: c.id,
    title: c.title,
    mainEntity: c.mainEntity,
    coreConcept: c.coreConcept,
    fullMarkdown: c.fullMarkdown || c.details?.join('\n'), // Fallback for old cards
    actionItems: c.actionItems?.map((a: any) => a.text) || [],
    category: c.category,
    tags: c.tags
  })));

  const prompt = `
    Analyze the following knowledge cards. 
    Identify cards that discuss the SAME 'mainEntity' or are HIGHLY semantically related.
    Merge them into comprehensive "Master-Detail" cards.
    
    ${langInstruction}

    Requirements for Merging:
    1. Create a new title.
    2. Synthesize a new core concept.
    3. Create a new 'index' (3-5 summary points).
    4. Write a new 'fullMarkdown' article that combines ALL details, arguments, and data from source cards.
       **Strict Formatting Rules:**
       - **TL;DR Block**: Start with a blockquote (> ) summarizing the core insight in under 50 words. Prefix with "💡 Core Insight" or "💡 核心金句".
       - **Emoji Anchors**: Every H2 (##) and H3 (###) header MUST start with a relevant emoji. Example: "## 💰 Pricing Strategy", "### 🚀 Performance".
       - **Forced Tables**: Use Markdown tables for ANY comparison (A vs B), parameter lists, or pros/cons analysis. Do NOT use plain lists for these.
    5. Generate a 'mindmap' (Mermaid.js) for the combined knowledge.
    6. Merge action items.
    7. Generate new tags.
    8. Keep the most relevant category.
    9. Specify 'mergedFromIds' or 'originalId'.

    **IMPORTANT: Auto Bi-directional Links**
    Here is a list of existing card titles in the knowledge base:
    ${JSON.stringify(existingTitles)}
    
    If you mention any of these existing titles or highly relevant core entities in your 'fullMarkdown', you MUST wrap them in double brackets like [[Title]].
    Example: "This concept is related to [[React Hooks]] and [[State Management]]."

    Input Cards:
    ${cardsJson}

    Output a JSON ARRAY of objects.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
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
              category: { type: Type.STRING }
            },
            required: ["title", "coreConcept", "index", "fullMarkdown", "mindmap", "tags", "category"]
          }
        }
      }
    });

    const result = JSON.parse(response.text || "[]");
    return result;
  } catch (error) {
    console.error("Error merging cards:", error);
    throw error;
  }
}

export async function searchRelatedImages(query: string, language: 'en' | 'zh' = 'en') {
  const model = "gemini-3-flash-preview";
  
  // We use the model to "search" by asking it to use the googleSearch tool 
  // and return the image URLs it finds.
  // Note: The current googleSearch tool in the SDK returns grounding metadata with web links.
  // It might not directly return image URLs in a structured way unless we ask for it specifically 
  // or if the model supports image search directly.
  // For this demo, we'll ask the model to find relevant image URLs from the web search results.

  const prompt = `
    Find 3 high-quality, real-world image URLs related to: "${query}".
    Prefer direct image links (jpg/png) if possible, or page URLs that likely contain the image.
    Return a JSON array of objects with 'url' and 'caption'.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              url: { type: Type.STRING },
              caption: { type: Type.STRING }
            }
          }
        }
      }
    });

    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Error searching images:", error);
    return [];
  }
}


export async function deepDiveResearch(card: { title: string; coreConcept: string; tags: string[] }, language: 'en' | 'zh' = 'en') {
  const model = "gemini-3-flash-preview"; // Use a model that supports search if needed, or standard for reasoning

  // Note: For actual Google Search, we need a model that supports tools.
  // gemini-3-flash-preview supports search grounding.
  
  const langInstruction = language === 'zh' 
    ? "Write the report in Simplified Chinese." 
    : "Write the report in English.";

  const prompt = `
    Conduct a "Deep Dive" research on the following topic. 
    Topic: ${card.title}
    Core Concept: ${card.coreConcept}
    Context Tags: ${card.tags.join(", ")}

    Please search for the latest information, deeper theories, or advanced usage related to this topic.
    Provide a comprehensive report in Markdown format. 
    ${langInstruction}

    Include:
    1. **Background & Context**: Why this matters.
    2. **Advanced Insights**: Go beyond the basics.
    3. **Practical Application**: How to apply this in real scenarios.
    4. **Related Trends**: What's new in this field.
    
    Keep the tone professional, insightful, and educational.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });

    const content = response.text || "No content generated.";
    
    // Extract sources if available
    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
      ?.map((chunk: any) => {
        if (chunk.web) {
          return { title: chunk.web.title, uri: chunk.web.uri };
        }
        return null;
      })
      .filter((source: any) => source !== null) as { title: string; uri: string }[] || [];

    return { content, sources };
  } catch (error) {
    console.error("Error performing deep dive:", error);
    throw error;
  }
}
