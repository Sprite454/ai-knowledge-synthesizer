import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Image as ImageIcon, Loader2, Sparkles, Maximize2, MessageSquare, Link as LinkIcon, ArrowRight, Minimize2, ZoomIn, Trash2, Edit2, Check, ExternalLink, Plus, Minus, RotateCcw, Split, Star, FolderInput, ChevronDown, Download, Clipboard, Send, Columns, MonitorPlay, Mic, ListChecks, BarChart3, Newspaper, MessageCircle, FileText, RefreshCw } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { KnowledgeCard } from "@/types";
import { Mermaid } from "./Mermaid";
import { aiApi } from "@/services/api";
import { pushToFeishu } from "@/services/feishu";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { exportSingleCard } from "@/services/export";
import { GlobalChat, GlobalChatRef } from "./GlobalChat";
import { PDFReader, PDFReaderRef } from "./PDFReader";

// Helper to extract domain for display
const getSourceDomain = (url?: string) => {
  if (!url) return null;
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace('www.', '');
  } catch (e) {
    return url;
  }
};

const getVideoEmbedUrl = (url: string) => {
  if (!url) return null;

  // Bilibili
  // https://www.bilibili.com/video/BV1xx411c7mD
  // Embed: //player.bilibili.com/player.html?bvid=BV1xx411c7mD
  const b_match = url.match(/bilibili\.com\/video\/(BV\w+)/i);
  if (b_match) {
    return `//player.bilibili.com/player.html?bvid=${b_match[1]}&high_quality=1&danmaku=0`;
  }

  // YouTube
  // https://www.youtube.com/watch?v=dQw4w9WgXcQ
  // https://youtu.be/dQw4w9WgXcQ
  // Embed: https://www.youtube.com/embed/dQw4w9WgXcQ
  const y_match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/i);
  if (y_match) {
    return `https://www.youtube.com/embed/${y_match[1]}`;
  }

  return null;
};

const LENS_OPTIONS = [
  { id: 'General', label: 'General', labelZh: '通用总结', icon: FileText, color: 'text-stone-500', bg: 'bg-stone-100' },
  { id: 'Interview', label: 'Interview', labelZh: '人物访谈', icon: Mic, color: 'text-purple-500', bg: 'bg-purple-100' },
  { id: 'Tutorial', label: 'Tutorial', labelZh: '操作教程', icon: ListChecks, color: 'text-green-500', bg: 'bg-green-100' },
  { id: 'Report', label: 'Report', labelZh: '深度研报', icon: BarChart3, color: 'text-blue-500', bg: 'bg-blue-100' },
  { id: 'News', label: 'News', labelZh: '新闻资讯', icon: Newspaper, color: 'text-red-500', bg: 'bg-red-100' },
  { id: 'Opinion', label: 'Opinion', labelZh: '观点评论', icon: MessageCircle, color: 'text-orange-500', bg: 'bg-orange-100' },
];

interface KnowledgeDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  card: KnowledgeCard | null;
  allCards: KnowledgeCard[]; // Need all cards to find backlinks and resolve links
  onChat: () => void;
  onNavigateToCard: (card: KnowledgeCard) => void;
  onDeleteCard: (cardId: string) => void;
  onUpdateCard: (cardId: string, updates: Partial<KnowledgeCard>) => void;
  onUnmerge?: (card: KnowledgeCard) => void;
  onMoveCard?: (cardId: string, category: string) => void;
  onToggleStar?: (cardId: string) => void;
  categories?: string[];
}

export function KnowledgeDetailModal({ isOpen, onClose, card, allCards, onChat, onNavigateToCard, onDeleteCard, onUpdateCard, onUnmerge, onMoveCard, onToggleStar, categories = [] }: KnowledgeDetailModalProps) {
  const { t, language } = useLanguage();
  const [isSearchingImages, setIsSearchingImages] = useState(false);
  const [additionalImages, setAdditionalImages] = useState<{ url: string; caption: string }[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [backlinks, setBacklinks] = useState<{ sourceCard: KnowledgeCard, context: string }[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMindmapOpen, setIsMindmapOpen] = useState(false);
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);

  // Lens State
  const [isLensMenuOpen, setIsLensMenuOpen] = useState(false);
  const [isResynthesizing, setIsResynthesizing] = useState(false);

  // Video Split View State
  const [isSplitView, setIsSplitView] = useState(false);
  const [videoEmbedUrl, setVideoEmbedUrl] = useState<string | null>(null);

  // PDF Split View
  const [isPdfSplitView, setIsPdfSplitView] = useState(false);
  const pdfReaderRef = useRef<PDFReaderRef>(null);

  useEffect(() => {
    if (card?.pdfFileId) {
      setIsPdfSplitView(true);
    } else {
      setIsPdfSplitView(false);
    }
  }, [card?.pdfFileId]);

  const handlePageLinkClick = (page: number) => {
    if (pdfReaderRef.current) {
      pdfReaderRef.current.jumpToPage(page);
    }
  };

  // Embedded Chat State
  const [showEmbeddedChat, setShowEmbeddedChat] = useState(false);

  // Chat Ref
  const chatRef = useRef<GlobalChatRef>(null);
  const [selectionTooltip, setSelectionTooltip] = useState<{ x: number, y: number, text: string } | null>(null);

  // Editing state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");

  const [isEditingSource, setIsEditingSource] = useState(false);
  const [editedSourceUrl, setEditedSourceUrl] = useState("");

  // Reset state when card changes
  useEffect(() => {
    if (isOpen) {
      setAdditionalImages([]);
      setIsFullscreen(false);
      setIsEditingTitle(false);
      setIsEditingSource(false);
      setIsCategoryMenuOpen(false);
      setShowEmbeddedChat(false); // Reset chat state
      if (card) {
        setEditedTitle(card.title);
        setEditedSourceUrl(card.sourceUrl || "");

        // Check for video
        const embed = getVideoEmbedUrl(card.sourceUrl || "");
        setVideoEmbedUrl(embed);
        if (embed) {
          setIsSplitView(true);
        } else {
          setIsSplitView(false);
        }
      }
    }
  }, [isOpen, card?.id]);

  const handleSaveTitle = () => {
    if (card && editedTitle.trim()) {
      onUpdateCard(card.id, { title: editedTitle.trim() });
      setIsEditingTitle(false);
    }
  };

  const handleSaveSourceUrl = () => {
    if (card) {
      onUpdateCard(card.id, { sourceUrl: editedSourceUrl.trim() });
      setIsEditingSource(false);
    }
  };

  const handleLensChange = async (type: string) => {
    if (!card || isResynthesizing) return;
    setIsLensMenuOpen(false);
    setIsResynthesizing(true);

    try {
      const sourceText = card.fullMarkdown || "";
      const isVideo = !!card.sourceUrl?.match(/(youtube|youtu\.be|bilibili)/);

      const result = await aiApi.synthesize({
        text: sourceText,
        images: card.images || [],
        language,
        existingTitles: allCards.map(c => c.title),
        existingCategories: categories,
        isVideo,
        forcedType: type === 'General' ? undefined : type,
      });

      onUpdateCard(card.id, {
        ...result,
        contentType: type,
        id: card.id,
        createdAt: card.createdAt,
        isStarred: card.isStarred,
        chatHistory: card.chatHistory,
        sourceUrl: card.sourceUrl,
        images: card.images
      });
    } catch (error) {
      console.error("Failed to switch lens:", error);
      alert(language === 'zh' ? "切换失败，请重试" : "Failed to switch lens, please try again");
    } finally {
      setIsResynthesizing(false);
    }
  };

  const handleSyncToFeishu = async () => {
    if (!card) return;
    const webhook = localStorage.getItem('feishu-webhook');
    if (!webhook) {
      alert(language === 'zh' ? "请先在侧边栏设置飞书 Webhook" : "Please set Feishu Webhook in sidebar settings first");
      return;
    }

    try {
      await pushToFeishu(card, webhook);
      alert(language === 'zh' ? "✅ 已推送到飞书" : "✅ Synced to Feishu");
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleUniversalCopy = async () => {
    if (!card) return;

    let content = card.fullMarkdown || "";

    // Step A: Fix newlines
    content = content.replace(/\\n/g, '\n');

    // Step B: Remove Frontmatter
    content = content.replace(/^---[\s\S]*?---\n/, '');

    // Step C: Add H1 Title
    const finalContent = `# ${card.title}\n\n${content}`;

    // Step D: Write to clipboard
    try {
      await navigator.clipboard.writeText(finalContent);
      alert(language === 'zh' ? "✅ 内容已复制！可直接粘贴到 Notion 或飞书" : "✅ Copied! Ready to paste into Notion or Feishu");
    } catch (err) {
      console.error('Failed to copy text: ', err);
      alert(language === 'zh' ? "复制失败" : "Copy failed");
    }
  };

  // Calculate backlinks
  useEffect(() => {
    if (card && allCards) {
      const links: { sourceCard: KnowledgeCard, context: string }[] = [];

      allCards.forEach(otherCard => {
        if (otherCard.id === card.id) return;

        // Check if other card mentions this card's title in [[ ]]
        // Regex to match [[Title]] where Title is case-insensitive match
        // We need to escape special regex chars in title if any
        const escapedTitle = card.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\[\\[${escapedTitle}\\]\\]`, 'i');

        if (otherCard.fullMarkdown && regex.test(otherCard.fullMarkdown)) {
          // Extract a snippet of context
          const matchIndex = otherCard.fullMarkdown.search(regex);
          const start = Math.max(0, matchIndex - 50);
          const end = Math.min(otherCard.fullMarkdown.length, matchIndex + 50 + card.title.length);
          const context = "..." + otherCard.fullMarkdown.substring(start, end) + "...";

          links.push({ sourceCard: otherCard, context });
        }
      });

      setBacklinks(links);
    }
  }, [card, allCards]);

  if (!card) return null;

  const handleSearchImages = async () => {
    setIsSearchingImages(true);
    try {
      // TODO: 图片搜索需要后端代理实现
      setAdditionalImages([]);
      console.warn('Image search not yet implemented via backend proxy');
    } catch (error) {
      console.error("Failed to search images:", error);
    } finally {
      setIsSearchingImages(false);
    }
  };

  const handleTimestampClick = (seconds: string) => {
    if (!videoEmbedUrl) return;
    // Update URL to include time to trigger jump (reloads iframe)
    let newUrl = videoEmbedUrl;
    // Remove existing time params
    newUrl = newUrl.replace(/[?&]start=\d+/, '').replace(/[?&]t=\d+/, '');

    const separator = newUrl.includes('?') ? '&' : '?';
    if (newUrl.includes('youtube')) {
      newUrl += `${separator}start=${seconds}`;
    } else if (newUrl.includes('bilibili')) {
      newUrl += `${separator}t=${seconds}`;
    }
    setVideoEmbedUrl(newUrl);
  };

  // Handle text selection for "Select to Ask"
  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      setSelectionTooltip(null);
      return;
    }

    const text = selection.toString().trim();
    if (text.length > 0) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      // Calculate position relative to viewport, but we need to consider if we are in a modal
      // Since the tooltip is fixed, clientX/Y or rect properties are fine
      setSelectionTooltip({
        x: rect.left + rect.width / 2,
        y: rect.top - 10, // slightly above
        text: text
      });
    } else {
      setSelectionTooltip(null);
    }
  };

  const handleAskSelection = () => {
    if (selectionTooltip && chatRef.current) {
      const question = `> 引用: "${selectionTooltip.text}"\n\n请解释这段话...`;

      // Ensure chat is visible
      if (!showEmbeddedChat) {
        setShowEmbeddedChat(true);
      }

      // Small delay to allow render
      setTimeout(() => {
        chatRef.current?.setInput(question);
        chatRef.current?.focus();
      }, 100);

      setSelectionTooltip(null);
    }
  };

  // Inject original images into markdown
  const injectImagesToMarkdown = (markdown: string, images: any[]) => {
    if (!images || images.length === 0) return markdown;

    // Process images to ensure they are valid URLs
    const validImages = images.map(img => {
      if (typeof img === 'string') {
        // Check if it's a data URI or a URL
        if (img.startsWith('data:') || img.startsWith('http') || img.startsWith('blob:')) {
          return img;
        }
        // If it's a base64 string without prefix, add it (assuming jpeg for simplicity, but ideally should detect)
        return `data:image/jpeg;base64,${img}`;
      } else if (img instanceof File || img instanceof Blob) {
        return URL.createObjectURL(img);
      }
      return null;
    }).filter(Boolean) as string[];

    if (validImages.length === 0) return markdown;

    const paragraphs = markdown.split('\n\n');
    let result = "";
    let imageIndex = 0;

    paragraphs.forEach((para, index) => {
      result += para + "\n\n";
      if ((index === 0 || index % 3 === 0) && imageIndex < validImages.length) {
        result += `![User Image ${imageIndex + 1}](${validImages[imageIndex]})\n\n`;
        imageIndex++;
      }
    });

    while (imageIndex < validImages.length) {
      result += `![User Image ${imageIndex + 1}](${validImages[imageIndex]})\n\n`;
      imageIndex++;
    }

    return result;
  };

  // Custom renderer for [[Title]] links and [MM:SS] timestamps
  const processMarkdownLinks = (text: string) => {
    if (!text) return "";
    let processed = text.replace(/\[\[(.*?)\]\]/g, (match, title) => {
      return `[${title}](internal-link:${title})`;
    });

    // Process timestamps [MM:SS] -> [MM:SS](timestamp:seconds)
    processed = processed.replace(/\[(\d{1,2}):(\d{2})\]/g, (match, mm, ss) => {
      const seconds = parseInt(mm) * 60 + parseInt(ss);
      return `[${match}](timestamp:${seconds})`;
    });

    // Process Page links [Page X] -> [Page X](#page-X)
    processed = processed.replace(/\[Page (\d+)\]/g, '[$&](#page-$1)');

    return processed;
  };

  // Sanitize markdown to remove broken image tags from old data and fix formatting issues
  const sanitizeMarkdown = (text: string) => {
    if (!text) return "";
    let cleanText = text;

    // Fix escaped newlines often returned by LLMs in JSON
    cleanText = cleanText.replace(/\\n/g, '\n');

    // Remove markdown images: ![alt](url)
    cleanText = cleanText.replace(/!\[.*?\]\(.*?\)/g, "");
    // Remove HTML images: <img ... />
    cleanText = cleanText.replace(/<img[^>]*>/g, "");

    return cleanText;
  };

  // 1. Sanitize first
  const sanitizedMarkdown = sanitizeMarkdown(card.fullMarkdown || "");
  // 2. Inject valid images
  const contentWithImages = injectImagesToMarkdown(sanitizedMarkdown, card.images || []);
  // 3. Process links
  const processedMarkdown = processMarkdownLinks(contentWithImages);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
              width: isFullscreen ? "100vw" : undefined,
              height: isFullscreen ? "100vh" : undefined,
              borderRadius: isFullscreen ? 0 : undefined,
              inset: isFullscreen ? 0 : undefined
            }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className={cn(
              "fixed bg-white shadow-2xl z-[70] overflow-hidden flex flex-col mx-auto transition-all",
              isFullscreen ? "inset-0 max-w-none rounded-none" : "inset-4 md:inset-10 rounded-2xl max-w-5xl"
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 bg-white/80 backdrop-blur-md sticky top-0 z-10">
              <div className="flex items-center gap-3 overflow-hidden flex-1 mr-4">
                {/* Category Badge with Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => onMoveCard && setIsCategoryMenuOpen(!isCategoryMenuOpen)}
                    className={cn(
                      "px-2 py-1 rounded-md bg-stone-100 text-stone-500 text-xs font-medium uppercase tracking-wide flex items-center gap-1 flex-shrink-0",
                      onMoveCard && "hover:bg-stone-200 hover:text-stone-700 cursor-pointer"
                    )}
                  >
                    {card.category}
                    {onMoveCard && <ChevronDown className="w-3 h-3" />}
                  </button>

                  {/* Category Dropdown */}
                  <AnimatePresence>
                    {isCategoryMenuOpen && onMoveCard && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsCategoryMenuOpen(false)} />
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: 5 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: 5 }}
                          className="absolute left-0 top-full mt-1 w-48 bg-white rounded-lg shadow-xl border border-stone-100 z-50 overflow-hidden"
                        >
                          <div className="px-3 py-2 text-xs font-semibold text-stone-400 uppercase border-b border-stone-50">
                            {language === 'zh' ? '移动到...' : 'Move to...'}
                          </div>
                          <div className="max-h-48 overflow-y-auto py-1">
                            {categories.map(cat => (
                              <button
                                key={cat}
                                onClick={() => {
                                  onMoveCard(card.id, cat);
                                  setIsCategoryMenuOpen(false);
                                }}
                                className={cn(
                                  "w-full text-left px-3 py-2 text-sm hover:bg-stone-50 flex items-center gap-2",
                                  card.category === cat ? "text-indigo-600 font-medium" : "text-stone-600"
                                )}
                              >
                                <FolderInput className="w-3 h-3" />
                                <span className="truncate">{cat}</span>
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>

                {/* Content Lens Badge */}
                <div className="relative ml-2">
                  <button
                    onClick={() => setIsLensMenuOpen(!isLensMenuOpen)}
                    disabled={isResynthesizing}
                    className={cn(
                      "px-2 py-1 rounded-md text-xs font-medium uppercase tracking-wide flex items-center gap-1 flex-shrink-0 transition-colors border border-transparent hover:border-stone-200",
                      (LENS_OPTIONS.find(l => l.id === card.contentType) || LENS_OPTIONS[0]).bg,
                      (LENS_OPTIONS.find(l => l.id === card.contentType) || LENS_OPTIONS[0]).color,
                      isResynthesizing && "opacity-70 cursor-wait"
                    )}
                    title={language === 'zh' ? '切换内容透镜' : 'Switch Content Lens'}
                  >
                    {isResynthesizing ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      (() => {
                        const LensIcon = (LENS_OPTIONS.find(l => l.id === card.contentType) || LENS_OPTIONS[0]).icon;
                        return <LensIcon className="w-3 h-3" />;
                      })()
                    )}
                    <span className="hidden sm:inline">
                      {language === 'zh'
                        ? (LENS_OPTIONS.find(l => l.id === card.contentType) || LENS_OPTIONS[0]).labelZh
                        : (LENS_OPTIONS.find(l => l.id === card.contentType) || LENS_OPTIONS[0]).label}
                    </span>
                    <ChevronDown className="w-3 h-3 opacity-50" />
                  </button>

                  {/* Lens Dropdown */}
                  <AnimatePresence>
                    {isLensMenuOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsLensMenuOpen(false)} />
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: 5 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: 5 }}
                          className="absolute left-0 top-full mt-1 w-48 bg-white rounded-lg shadow-xl border border-stone-100 z-50 overflow-hidden"
                        >
                          <div className="px-3 py-2 text-xs font-semibold text-stone-400 uppercase border-b border-stone-50">
                            {language === 'zh' ? '切换透镜 (重新生成)' : 'Switch Lens (Regenerate)'}
                          </div>
                          <div className="max-h-64 overflow-y-auto py-1">
                            {LENS_OPTIONS.map(lens => (
                              <button
                                key={lens.id}
                                onClick={() => handleLensChange(lens.id)}
                                disabled={isResynthesizing}
                                className={cn(
                                  "w-full text-left px-3 py-2 text-sm hover:bg-stone-50 flex items-center gap-2 transition-colors",
                                  card.contentType === lens.id ? "bg-stone-50 font-medium" : "text-stone-600"
                                )}
                              >
                                <lens.icon className={cn("w-4 h-4", lens.color)} />
                                <span className="truncate">{language === 'zh' ? lens.labelZh : lens.label}</span>
                                {card.contentType === lens.id && <Check className="w-3 h-3 ml-auto text-indigo-600" />}
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>

                {isEditingTitle ? (
                  <div className="flex items-center gap-2 flex-1 max-w-md">
                    <input
                      type="text"
                      value={editedTitle}
                      onChange={(e) => setEditedTitle(e.target.value)}
                      className="flex-1 px-2 py-1 text-lg font-bold border border-indigo-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-200"
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveTitle()}
                    />
                    <button onClick={handleSaveTitle} className="p-1 text-green-600 hover:bg-green-50 rounded">
                      <Check className="w-5 h-5" />
                    </button>
                    <button onClick={() => setIsEditingTitle(false)} className="p-1 text-stone-400 hover:bg-stone-100 rounded">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-0.5 overflow-hidden group">
                    <div className="flex items-center gap-2">
                      <h2 className="font-bold text-lg text-stone-900 truncate">
                        {card.title}
                      </h2>
                      <button
                        onClick={() => setIsEditingTitle(true)}
                        className="p-1 text-stone-300 hover:text-stone-600 hover:bg-stone-100 rounded transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Source Link Display (Cubox Style) */}
                    {card.sourceUrl && (
                      <div className="flex items-center gap-1.5 text-xs text-stone-400">
                        <ExternalLink className="w-3 h-3" />
                        <span>{language === 'zh' ? '来源:' : 'Source:'}</span>
                        <a
                          href={card.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-indigo-600 hover:underline transition-colors truncate max-w-[200px]"
                        >
                          {getSourceDomain(card.sourceUrl)}
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Star Button */}
                {onToggleStar && (
                  <button
                    onClick={() => onToggleStar(card.id)}
                    className={cn(
                      "p-2 rounded-full transition-colors",
                      card.isStarred ? "text-yellow-400 bg-yellow-50 hover:bg-yellow-100" : "text-stone-400 hover:text-yellow-400 hover:bg-stone-100"
                    )}
                    title={card.isStarred ? "Unstar" : "Star"}
                  >
                    <Star className={cn("w-5 h-5", card.isStarred && "fill-current")} />
                  </button>
                )}

                {/* Export Button */}
                <button
                  onClick={() => exportSingleCard(card)}
                  className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-full transition-colors"
                  title={language === 'zh' ? '导出为 Markdown' : 'Export to Markdown'}
                >
                  <Download className="w-5 h-5" />
                </button>

                {/* Universal Copy Button */}
                <button
                  onClick={handleUniversalCopy}
                  className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-full transition-colors"
                  title={language === 'zh' ? '可直接粘贴至 Notion、飞书文档或 Obsidian' : 'Copy for Notion, Feishu, or Obsidian'}
                >
                  <Clipboard className="w-5 h-5" />
                </button>

                <button
                  onClick={handleSyncToFeishu}
                  className="p-2 text-stone-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                  title={language === 'zh' ? '同步到飞书' : 'Sync to Feishu'}
                >
                  <Send className="w-5 h-5" />
                </button>

                <div className="w-px h-6 bg-stone-200 mx-1" />

                <button
                  onClick={() => setShowEmbeddedChat(!showEmbeddedChat)}
                  className={cn(
                    "hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
                    showEmbeddedChat
                      ? "bg-indigo-600 text-white shadow-md hover:bg-indigo-700"
                      : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                  )}
                >
                  <MessageSquare className="w-4 h-4" />
                  {language === 'zh' ? '深度对话' : 'Deep Chat'}
                </button>
                <button
                  onClick={handleSearchImages}
                  disabled={isSearchingImages}
                  className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-600 text-sm font-medium hover:bg-indigo-100 transition-colors"
                >
                  {isSearchingImages ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {language === 'zh' ? 'AI 智能配图' : 'AI Smart Images'}
                </button>

                <div className="w-px h-6 bg-stone-200 mx-1" />

                {/* Split View Toggle (Only if video available) */}
                {videoEmbedUrl && (
                  <>
                    <button
                      onClick={() => setIsSplitView(!isSplitView)}
                      className={cn(
                        "p-2 rounded-full transition-colors",
                        isSplitView ? "text-indigo-600 bg-indigo-50" : "text-stone-400 hover:text-stone-600 hover:bg-stone-100"
                      )}
                      title={language === 'zh' ? '分屏模式' : 'Split View'}
                    >
                      <Columns className="w-5 h-5" />
                    </button>
                    <div className="w-px h-6 bg-stone-200 mx-1" />
                  </>
                )}

                <button
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-full transition-colors"
                  title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                >
                  {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                </button>
                <button
                  onClick={onClose}
                  className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content Area - Flex Container for Split View */}
            <div className={cn(
              "flex-1 overflow-hidden flex flex-col md:flex-row relative bg-[#F7F6F3]",
              (isSplitView && videoEmbedUrl) || (isPdfSplitView && card?.pdfFileId) ? "" : ""
            )}>

              {/* Left Side: Video Player or PDF Reader (Visible only in Split View) */}
              {((isSplitView && videoEmbedUrl) || (isPdfSplitView && card?.pdfFileId)) && (
                <div className="w-full md:w-1/2 h-[300px] md:h-auto bg-stone-100 relative z-10 flex-shrink-0 shadow-xl border-r border-stone-200">
                  {isSplitView && videoEmbedUrl ? (
                    <iframe
                      src={videoEmbedUrl}
                      className="w-full h-full"
                      allowFullScreen
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      frameBorder="0"
                    />
                  ) : (
                    <PDFReader fileId={card!.pdfFileId!} ref={pdfReaderRef} />
                  )}
                </div>
              )}

              {/* Right Side: Markdown Content + Chat (Vertical Split) */}
              <div className={cn(
                "flex-1 flex flex-col h-full overflow-hidden relative bg-white transition-all duration-300",
                (isSplitView && videoEmbedUrl) || (isPdfSplitView && card?.pdfFileId) ? "md:w-1/2" : "w-full"
              )}>
                {/* Node A: Reading Area (Scrollable) */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8 scroll-smooth" id="reading-container">
                  <div className={cn("mx-auto space-y-8", isFullscreen && !isSplitView ? "max-w-5xl" : "max-w-3xl")}>

                    {/* Source Link Section */}
                    <div className="flex justify-start">
                      {isEditingSource ? (
                        <div className="flex items-center gap-2 w-full max-w-md">
                          <div className="flex-1 flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-200">
                            <LinkIcon className="w-4 h-4 text-stone-400" />
                            <input
                              type="text"
                              value={editedSourceUrl}
                              onChange={(e) => setEditedSourceUrl(e.target.value)}
                              placeholder="https://..."
                              className="flex-1 text-sm outline-none text-stone-700 placeholder:text-stone-400"
                              autoFocus
                              onKeyDown={(e) => e.key === 'Enter' && handleSaveSourceUrl()}
                            />
                          </div>
                          <button onClick={handleSaveSourceUrl} className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors">
                            <Check className="w-5 h-5" />
                          </button>
                          <button onClick={() => setIsEditingSource(false)} className="p-2 text-stone-400 hover:bg-stone-100 rounded-lg transition-colors">
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 group">
                          {card.sourceUrl ? (
                            <a
                              href={card.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-stone-200 rounded-full text-sm font-medium text-stone-600 hover:text-indigo-600 hover:border-indigo-200 hover:shadow-sm transition-all"
                            >
                              <ExternalLink className="w-4 h-4" />
                              {language === 'zh' ? '访问原链接' : 'Visit Source'}
                            </a>
                          ) : (
                            <button
                              onClick={() => setIsEditingSource(true)}
                              className="inline-flex items-center gap-2 px-4 py-2 bg-transparent border border-dashed border-stone-300 rounded-full text-sm font-medium text-stone-400 hover:text-stone-600 hover:border-stone-400 hover:bg-stone-50 transition-all"
                            >
                              <Plus className="w-4 h-4" />
                              {language === 'zh' ? '添加来源链接' : 'Add Source URL'}
                            </button>
                          )}

                          {card.sourceUrl && (
                            <button
                              onClick={() => {
                                setEditedSourceUrl(card.sourceUrl || "");
                                setIsEditingSource(true);
                              }}
                              className="p-2 text-stone-300 hover:text-stone-600 hover:bg-stone-100 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                              title={language === 'zh' ? '编辑链接' : 'Edit URL'}
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Mindmap Section */}
                    {card.mindmap && (
                      <div
                        className="bg-white p-6 rounded-xl shadow-sm border border-stone-100 overflow-hidden relative group cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => setIsMindmapOpen(true)}
                      >
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-xs font-bold text-stone-400 uppercase tracking-wider">Logic Structure</h3>
                          <div className="flex items-center gap-1 text-xs text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity">
                            <ZoomIn className="w-3 h-3" />
                            Click to expand
                          </div>
                        </div>
                        <div className="overflow-x-auto">
                          <Mermaid chart={card.mindmap} />
                        </div>
                      </div>
                    )}

                    {/* Main Article */}
                    <article className="prose prose-lg prose-stone max-w-none bg-white p-8 md:p-12 rounded-xl shadow-sm border border-stone-100 leading-relaxed">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          h1: ({ node, ...props }) => <h1 {...props} className="text-3xl font-bold text-stone-900 mb-6 mt-2" />,
                          h2: ({ node, ...props }) => <h2 {...props} className="text-2xl font-bold text-stone-800 mt-10 mb-4 pb-2 border-b border-stone-100" />,
                          h3: ({ node, ...props }) => <h3 {...props} className="text-xl font-semibold text-stone-800 mt-8 mb-3" />,
                          p: ({ node, ...props }) => <p {...props} className="text-stone-700 mb-6 leading-loose" />,
                          li: ({ node, ...props }) => <li {...props} className="text-stone-700 mb-2" />,
                          strong: ({ node, ...props }) => <strong {...props} className="font-bold text-stone-900" />,
                          blockquote: ({ node, ...props }) => (
                            <blockquote className="border-l-4 border-yellow-400 bg-yellow-50/50 pl-4 py-3 pr-4 my-6 rounded-r-lg italic text-stone-700" {...props} />
                          ),
                          // Table styling
                          table: ({ node, ...props }) => (
                            <div className="overflow-x-auto my-8 rounded-lg border border-stone-200 shadow-sm">
                              <table className="min-w-full divide-y divide-stone-200" {...props} />
                            </div>
                          ),
                          thead: ({ node, ...props }) => <thead className="bg-stone-50" {...props} />,
                          th: ({ node, ...props }) => <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider" {...props} />,
                          tbody: ({ node, ...props }) => <tbody className="bg-white divide-y divide-stone-200" {...props} />,
                          tr: ({ node, ...props }) => <tr className="hover:bg-stone-50 transition-colors" {...props} />,
                          td: ({ node, ...props }) => <td className="px-6 py-4 whitespace-normal text-sm text-stone-700 leading-relaxed" {...props} />,
                          img: ({ node, ...props }) => (
                            <div className="my-8 relative group cursor-pointer" onClick={() => setPreviewImage(props.src as string)}>
                              <img {...props} className="rounded-lg shadow-md w-full object-cover max-h-[500px]" />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 rounded-lg">
                                <Maximize2 className="w-8 h-8 text-white drop-shadow-md" />
                              </div>
                            </div>
                          ),
                          a: ({ node, ...props }) => {
                            const href = props.href || "";
                            if (href.startsWith("#page-")) {
                              const page = parseInt(href.replace("#page-", ""), 10);
                              return (
                                <span
                                  onClick={() => handlePageLinkClick(page)}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-orange-50 text-orange-600 font-mono text-xs cursor-pointer hover:bg-orange-100 transition-colors border border-orange-200"
                                  title={`Jump to page ${page}`}
                                >
                                  <FileText className="w-3 h-3" />
                                  Page {page}
                                </span>
                              );
                            }
                            if (href.startsWith("internal-link:")) {
                              const title = href.replace("internal-link:", "");
                              return (
                                <span
                                  onClick={() => {
                                    const targetCard = allCards.find(c => c.title.toLowerCase() === title.toLowerCase());
                                    if (targetCard) {
                                      onNavigateToCard(targetCard);
                                    } else {
                                      alert(language === 'zh' ? "未找到相关卡片" : "Card not found");
                                    }
                                  }}
                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-medium cursor-pointer hover:bg-indigo-100 transition-colors border-b border-indigo-200"
                                >
                                  <LinkIcon className="w-3 h-3" />
                                  {props.children}
                                </span>
                              );
                            }
                            if (href.startsWith("timestamp:")) {
                              const seconds = href.replace("timestamp:", "");
                              return (
                                <span
                                  onClick={() => handleTimestampClick(seconds)}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-mono text-xs cursor-pointer hover:bg-blue-100 transition-colors border border-blue-200"
                                  title="Jump to video time"
                                >
                                  <MonitorPlay className="w-3 h-3" />
                                  {props.children}
                                </span>
                              );
                            }
                            return <a {...props} className="text-indigo-600 hover:underline" target="_blank" rel="noopener noreferrer" />;
                          }
                        }}
                      >
                        {processedMarkdown}
                      </ReactMarkdown>

                      {/* AI Generated Images */}
                      {additionalImages.length > 0 && (
                        <div className="mt-12 pt-8 border-t border-stone-100">
                          <h3 className="flex items-center gap-2 font-bold text-xl mb-6 text-indigo-900">
                            <Sparkles className="w-5 h-5 text-indigo-500" />
                            {language === 'zh' ? 'AI 推荐图库' : 'AI Recommended Gallery'}
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {additionalImages.map((img, idx) => (
                              <div key={idx} className="space-y-2">
                                <img
                                  src={img.url}
                                  alt={img.caption}
                                  className="rounded-lg shadow-md w-full h-48 object-cover"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                  }}
                                />
                                <p className="text-xs text-stone-500 text-center italic">{img.caption}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </article>

                    {/* Backlinks Panel */}
                    {backlinks.length > 0 && (
                      <div className="bg-stone-100 p-6 rounded-xl border border-stone-200">
                        <h3 className="flex items-center gap-2 font-bold text-stone-700 mb-4">
                          <LinkIcon className="w-4 h-4" />
                          {language === 'zh' ? '🔗 提及此页面的笔记 (Backlinks)' : '🔗 Backlinks'}
                        </h3>
                        <div className="space-y-3">
                          {backlinks.map((link, idx) => (
                            <div
                              key={idx}
                              onClick={() => onNavigateToCard(link.sourceCard)}
                              className="bg-white p-4 rounded-lg shadow-sm hover:shadow-md transition-all cursor-pointer group border border-stone-200"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-semibold text-stone-900 group-hover:text-indigo-600 transition-colors">
                                  {link.sourceCard.title}
                                </span>
                                <ArrowRight className="w-4 h-4 text-stone-300 group-hover:text-indigo-400" />
                              </div>
                              <p className="text-sm text-stone-500 italic line-clamp-2">
                                "{link.context}"
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Delete and Unmerge Buttons */}
                    <div className="flex justify-between pt-8 border-t border-stone-200">
                      {card.sourceCards && card.sourceCards.length > 0 && onUnmerge ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            console.log("Unmerge button clicked");
                            e.stopPropagation();
                            onUnmerge(card);
                          }}
                          className="flex items-center gap-2 px-4 py-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors text-sm font-medium"
                        >
                          <Split className="w-4 h-4" />
                          {language === 'zh' ? '解散合集 (恢复原卡片)' : 'Unmerge (Restore Originals)'}
                        </button>
                      ) : (
                        <div></div> // Spacer
                      )}

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteCard(card.id);
                        }}
                        className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium"
                      >
                        <Trash2 className="w-4 h-4" />
                        {language === 'zh' ? '删除' : 'Delete'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Node B: Chat Area (Fixed Height) */}
                <AnimatePresence>
                  {showEmbeddedChat && (
                    <motion.div
                      initial={{ height: 0, opacity: 0, y: 20 }}
                      animate={{ height: "40%", opacity: 1, y: 0 }}
                      exit={{ height: 0, opacity: 0, y: 20 }}
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      className="flex-shrink-0 z-20 p-4 bg-transparent pointer-events-none flex flex-col min-h-[300px] max-h-[60%]"
                    >
                      <div className="w-full h-full bg-white rounded-2xl shadow-xl border border-stone-200 overflow-hidden flex flex-col pointer-events-auto ring-1 ring-black/5">
                        <GlobalChat
                          ref={chatRef}
                          cards={allCards}
                          onOpenDetail={onNavigateToCard}
                          isOpen={true}
                          onToggle={() => { }}
                          targetCard={card}
                          onClearTarget={() => { }}
                          mode="embedded"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>

          {/* Selection Tooltip */}
          <AnimatePresence>
            {selectionTooltip && (
              <motion.button
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 10 }}
                style={{
                  position: 'fixed',
                  left: selectionTooltip.x,
                  top: selectionTooltip.y,
                  transform: 'translate(-50%, -100%)',
                  zIndex: 100
                }}
                onClick={handleAskSelection}
                className="bg-indigo-600 text-white px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 text-xs font-medium hover:bg-indigo-700 transition-colors pointer-events-auto"
              >
                <Sparkles className="w-3 h-3" />
                {language === 'zh' ? '询问 AI' : 'Ask AI'}
              </motion.button>
            )}
          </AnimatePresence>

          {/* Mindmap Lightbox with Zoom/Pan */}
          <AnimatePresence>
            {isMindmapOpen && card.mindmap && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-white/95 z-[80] flex flex-col"
              >
                {/* Controls Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 bg-white shadow-sm z-10">
                  <h3 className="font-bold text-stone-800 flex items-center gap-2">
                    <ZoomIn className="w-5 h-5 text-indigo-600" />
                    Mindmap View
                  </h3>
                  <button
                    onClick={() => setIsMindmapOpen(false)}
                    className="p-2 bg-stone-100 hover:bg-stone-200 rounded-full text-stone-500 transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                {/* Zoomable Area */}
                <div className="flex-1 overflow-hidden bg-stone-50 relative">
                  <TransformWrapper
                    initialScale={1}
                    minScale={0.5}
                    maxScale={4}
                    centerOnInit
                    wheel={{ step: 0.1 }}
                  >
                    {({ zoomIn, zoomOut, resetTransform }) => (
                      <>
                        <div className="absolute top-4 right-4 z-20 flex flex-col gap-2 bg-white p-2 rounded-lg shadow-md border border-stone-200">
                          <button onClick={() => zoomIn()} className="p-2 hover:bg-stone-100 rounded text-stone-600" title="Zoom In">
                            <Plus className="w-5 h-5" />
                          </button>
                          <button onClick={() => zoomOut()} className="p-2 hover:bg-stone-100 rounded text-stone-600" title="Zoom Out">
                            <Minus className="w-5 h-5" />
                          </button>
                          <button onClick={() => resetTransform()} className="p-2 hover:bg-stone-100 rounded text-stone-600" title="Reset">
                            <RotateCcw className="w-5 h-5" />
                          </button>
                        </div>
                        <TransformComponent wrapperClass="w-full h-full" contentClass="w-full h-full flex items-center justify-center">
                          <div className="min-w-[800px] min-h-[600px] p-10">
                            <Mermaid chart={card.mindmap!} />
                          </div>
                        </TransformComponent>
                      </>
                    )}
                  </TransformWrapper>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Image Preview Modal */}
          <AnimatePresence>
            {previewImage && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setPreviewImage(null)}
                className="fixed inset-0 bg-black/90 z-[90] flex items-center justify-center p-4 cursor-zoom-out"
              >
                <img
                  src={previewImage}
                  alt="Full preview"
                  className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                />
                <button
                  onClick={() => setPreviewImage(null)}
                  className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors"
                >
                  <X className="w-8 h-8" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </AnimatePresence>
  );
}
