import { KnowledgeCard } from "@/types";

const formatForFeishu = (text: string): string => {
  if (!text) return "";
  return text
    .replace(/\\n/g, '\n') // Restore literal \n to actual newlines
    .replace(/\\"/g, '"') // Restore escaped double quotes
    .replace(/^##+\s+(.+)$/gm, '**$1**') // Convert Headers to Bold
    .replace(/^-\s+(.+)$/gm, '🔹 $1') // Convert List items to Emoji bullets
    .replace(/!\[.*?\]\(.*?\)/g, '🖼️ [图片]') // Placeholder for images
    .replace(/<img[^>]*>/g, '🖼️ [图片]');
};

const extractTableFields = (markdown: string) => {
  if (!markdown) return [];

  // Simple regex to find a markdown table block
  // We look for lines starting with |
  const lines = markdown.split('\n');
  const fields = [];
  let foundSeparator = false;

  // Try to find the separator line |---|---| to confirm it's a table
  const separatorIndex = lines.findIndex(line => line.trim().match(/^\|[-:| ]+\|$/));

  if (separatorIndex > 0) {
    // Start reading from the line after separator
    for (let i = separatorIndex + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line.startsWith('|')) break; // End of table

      const cells = line.split('|').map(c => c.trim()).filter(c => c);
      if (cells.length >= 2) {
        // Assume Key | Value format
        fields.push({
          is_short: true,
          text: {
            tag: "lark_md",
            content: `**${cells[0]}**\n${cells[1]}`
          }
        });
      }
      if (fields.length >= 6) break; // Limit to 6 fields
    }
  }

  return fields;
};

export async function pushToFeishu(card: KnowledgeCard, webhookUrl: string) {
  if (!webhookUrl) {
    throw new Error("Webhook URL is missing");
  }

  const cleanContent = formatForFeishu(card.fullMarkdown || "");
  const tableFields = extractTableFields(card.fullMarkdown || "");

  const elements: any[] = [
    // Module A: Core Summary
    {
      tag: "div",
      text: {
        tag: "lark_md",
        content: `💡 **核心摘要**\n${card.coreConcept || (card.index?.[0] || "暂无摘要")}`
      }
    }
  ];

  // Module B: Parameters (Fields)
  if (tableFields.length > 0) {
    elements.push({ tag: "hr" });
    elements.push({
      tag: "div",
      fields: tableFields
    });
  } else {
    // If no table, show text snippet
    elements.push({ tag: "hr" });
    elements.push({
      tag: "div",
      text: {
        tag: "lark_md",
        content: cleanContent.slice(0, 500) + (cleanContent.length > 500 ? "..." : "")
      }
    });
  }

  // Module C: Tags
  if (card.tags && card.tags.length > 0) {
    elements.push({ tag: "hr" });
    elements.push({
      tag: "note",
      elements: card.tags.map(tag => ({
        tag: "plain_text",
        content: `🏷️ #${tag} `
      }))
    });
  }

  // Module D: Actions
  const actions = [];
  if (card.sourceUrl) {
    actions.push({
      tag: "button",
      text: {
        tag: "plain_text",
        content: "🔗 查看原文"
      },
      url: card.sourceUrl,
      type: "primary"
    });
  }

  // Note: "Copy Full Content" button is not fully supported in Feishu Webhook cards 
  // as it cannot trigger client-side clipboard actions. 
  // We omit it to avoid broken UX, relying on the "View Source" or the app's internal copy button.

  if (actions.length > 0) {
    elements.push({
      tag: "action",
      actions: actions
    });
  }

  // Construct Feishu Card JSON
  const cardContent = {
    config: {
      wide_screen_mode: true
    },
    header: {
      title: {
        tag: "plain_text",
        content: card.title
      },
      template: "blue"
    },
    elements: elements
  };

  const payload = {
    msg_type: "interactive",
    card: cardContent
  };

  try {
    // 通过后端代理发送飞书 Webhook（解决 CORS 问题）
    const response = await fetch('/api/v1/proxy/feishu', {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ webhookUrl, payload })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Feishu API Error: ${response.status} ${text}`);
    }
    return true;
  } catch (error: any) {
    console.error("Feishu Sync Error:", error);
    throw error;
  }
}

export function copyForFeishu(card: KnowledgeCard) {
  let content = formatForFeishu(card.fullMarkdown || "");

  // Remove YAML frontmatter
  content = content.replace(/^---[\s\S]*?---\n/, '');

  // Replace images ![]() with [图片上传中...]
  content = content.replace(/!\[.*?\]\(.*?\)/g, "[图片上传中...]");
  content = content.replace(/<img[^>]*>/g, "[图片上传中...]");

  // Copy to clipboard
  // Try to use Clipboard API with text/plain (Feishu handles markdown well if it's clean text)
  // We are not converting to HTML here to keep it simple and robust as requested fallback
  navigator.clipboard.writeText(content);
}
