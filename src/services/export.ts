import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { KnowledgeCard } from '@/types';

const cleanMarkdownContent = (rawText: string): string => {
  if (!rawText) return "";
  return rawText
    .replace(/\\n/g, '\n') // Restore literal \n to actual newlines
    .replace(/\\"/g, '"'); // Restore escaped double quotes
};

/**
 * Generates the Markdown content for a card, including YAML Frontmatter.
 */
export const generateCardMarkdown = (card: KnowledgeCard): string => {
  const frontmatter = [
    '---',
    `title: "${card.title.replace(/"/g, '\\"')}"`,
    `category: "${card.category}"`,
    `tags: [${card.tags.map(t => `"${t}"`).join(', ')}]`,
    `sourceUrl: "${card.sourceUrl || ''}"`,
    `createDate: "${new Date(card.createdAt).toISOString()}"`,
    '---',
    '',
    ''
  ].join('\n');

  let content = cleanMarkdownContent(card.fullMarkdown || '');
  
  // Append Mermaid code block if mindmap exists
  if (card.mindmap) {
    content += '\n\n```mermaid\n' + card.mindmap + '\n```';
  }

  return frontmatter + content;
};

/**
 * Exports a single card as a Markdown file.
 */
export const exportSingleCard = (card: KnowledgeCard) => {
  const markdown = generateCardMarkdown(card);
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  saveAs(blob, `${card.title}.md`);
};

/**
 * Exports all cards as a ZIP file containing Markdown files.
 */
export const exportAllCards = async (cards: KnowledgeCard[]) => {
  const zip = new JSZip();
  const folder = zip.folder("knowledge-base");

  if (!folder) return;

  cards.forEach(card => {
    const markdown = generateCardMarkdown(card);
    // Sanitize filename
    const filename = `${card.title.replace(/[\\/:*?"<>|]/g, '_')}.md`;
    folder.file(filename, markdown);
  });

  const content = await zip.generateAsync({ type: "blob" });
  saveAs(content, "knowledge-base.zip");
};

/**
 * Generates Notion-friendly Markdown content.
 * Notion prefers # Title at the top and property lists instead of YAML frontmatter.
 */
export const generateNotionMarkdown = (card: KnowledgeCard): string => {
  const header = [
    `# ${card.title}`,
    '',
    `**Category:** ${card.category}`,
    `**Tags:** ${card.tags.join(', ')}`,
    `**Source:** ${card.sourceUrl || 'N/A'}`,
    `**Created:** ${new Date(card.createdAt).toLocaleDateString()}`,
    '',
    '---',
    '',
  ].join('\n');

  let content = cleanMarkdownContent(card.fullMarkdown || '');
  
  // Append Mermaid code block if mindmap exists
  if (card.mindmap) {
    content += '\n\n```mermaid\n' + card.mindmap + '\n```';
  }

  return header + content;
};

/**
 * Copies card content to clipboard in a Notion-friendly format.
 */
export const copyToNotion = async (card: KnowledgeCard): Promise<void> => {
  const markdown = generateNotionMarkdown(card);
  try {
    await navigator.clipboard.writeText(markdown);
  } catch (err) {
    console.error('Failed to copy text: ', err);
    throw err;
  }
};
