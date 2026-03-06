import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MessageCircle, X, Send, Bot, User, Sparkles, ArrowLeft, Globe, Maximize2, Minimize2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { KnowledgeCard, ChatMessage } from "@/types";
import { aiApi } from "@/services/api";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

export interface GlobalChatRef {
  setInput: (text: string) => void;
  focus: () => void;
}

interface GlobalChatProps {
  cards: KnowledgeCard[];
  onOpenDetail: (card: KnowledgeCard) => void;
  isOpen: boolean;
  onToggle: (isOpen: boolean) => void;
  targetCard?: KnowledgeCard | null;
  onClearTarget?: () => void;
  mode?: 'floating' | 'embedded';
}

export const GlobalChat = forwardRef<GlobalChatRef, GlobalChatProps>(({ cards, onOpenDetail, isOpen, onToggle, targetCard, onClearTarget, mode = 'floating' }, ref) => {
  const { language } = useLanguage();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [enableSearch, setEnableSearch] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    setInput: (text: string) => setInput(text),
    focus: () => inputRef.current?.focus()
  }));

  // Reset messages when targetCard changes
  useEffect(() => {
    const welcomeMsg: ChatMessage = {
      id: 'welcome',
      role: 'assistant',
      content: targetCard
        ? (language === 'zh'
          ? `你好！我是针对卡片 "${targetCard.title}" 的助手。有什么我可以帮你的吗？`
          : `Hello! I'm your assistant for "${targetCard.title}". How can I help you?`)
        : (language === 'zh'
          ? "你好！我是你的个人知识库助手。有什么我可以帮你的吗？"
          : "Hello! I'm your personal knowledge base assistant. How can I help you?"),
      timestamp: Date.now()
    };
    setMessages([welcomeMsg]);
  }, [targetCard, language]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = async (textOverride?: string) => {
    const textToSend = textOverride || input;
    if (!textToSend.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: textToSend,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      let context = "";

      if (targetCard) {
        // Specific Card Context
        context = `
[Source: ${targetCard.title}]
Category: ${targetCard.category}
Tags: ${targetCard.tags.join(", ")}
Content:
${targetCard.fullMarkdown || (targetCard.index || []).join("\n")}
`;
      } else {
        // Global Context (RAG)
        // 1. Filter relevant cards based on simple keyword matching to reduce context size
        const queryKeywords = textToSend.toLowerCase().split(/\s+/).filter(k => k.length > 1);

        const relevantCards = cards.filter(card => {
          const content = (card.title + " " + card.fullMarkdown + " " + (card.index || []).join(" ")).toLowerCase();
          // Simple scoring: count how many keywords appear
          const score = queryKeywords.reduce((acc, keyword) => {
            return acc + (content.includes(keyword) ? 1 : 0);
          }, 0);
          return score > 0;
        }).sort((a, b) => {
          // Sort by relevance (keyword match count) - simplified
          return 0;
        }).slice(0, 10); // Limit to top 10 relevant cards to fit context

        // 2. Construct Context
        context = relevantCards.map(card => `
[Source: ${card.title}]
Category: ${card.category}
Tags: ${card.tags.join(", ")}
Content:
${card.fullMarkdown || (card.index || []).join("\n")}
`).join("\n---\n");
      }

      // Call AI Service
      const { content, suggestedQuestions } = await aiApi.chat({
        messages: [...messages, userMessage],
        context,
        language,
        enableSearch,
      });

      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: content,
        timestamp: Date.now(),
        suggestedQuestions
      };

      setMessages(prev => [...prev, aiMessage]);

    } catch (error) {
      console.error("Global chat error:", error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: language === 'zh' ? "抱歉，我遇到了一些问题，请稍后再试。" : "Sorry, I encountered an issue. Please try again later.",
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Custom renderer for ReactMarkdown to handle source links
  const renderers = {
    text: ({ node, children }: any) => {
      // This is a simplified approach. ReactMarkdown parses text nodes.
      // We might need a custom plugin or just simple regex replacement on the content string before rendering if we want true interactivity within markdown.
      // However, for simplicity in this "surgical" update, let's try to parse the content string in the message display.
      return <span>{children}</span>;
    }
  };

  // Helper to parse text and make sources clickable
  const renderMessageContent = (content: string) => {
    // Regex to match [Source: Title] or [来源: Title]
    const sourceRegex = /\[(Source|来源):\s*(.+?)\]/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = sourceRegex.exec(content)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        parts.push(content.substring(lastIndex, match.index));
      }

      const fullMatch = match[0];
      const title = match[2];

      // Find the card
      const card = cards.find(c => c.title.trim() === title.trim());

      if (card) {
        parts.push(
          <button
            key={match.index}
            onClick={() => onOpenDetail(card)}
            className="text-indigo-600 hover:underline font-medium inline-flex items-center gap-0.5"
          >
            <BookOpenIcon className="w-3 h-3" />
            {title}
          </button>
        );
      } else {
        parts.push(<span key={match.index} className="text-stone-500 font-medium">{title}</span>);
      }

      lastIndex = match.index + fullMatch.length;
    }

    // Add remaining text
    if (lastIndex < content.length) {
      parts.push(content.substring(lastIndex));
    }

    // If no sources found, just return markdown
    if (parts.length === 0) {
      return (
        <div className="prose prose-sm max-w-none">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      );
    }

    return (
      <div className="prose prose-sm max-w-none">
        {parts.map((part, i) => (
          typeof part === 'string' ? <ReactMarkdown key={i}>{part}</ReactMarkdown> : part
        ))}
      </div>
    );
  };

  const renderSuggestedQuestions = (questions?: string[]) => {
    if (!questions || questions.length === 0) return null;
    return (
      <div className="mt-3 flex flex-wrap gap-2">
        {questions.map((q, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(q)}
            className="text-xs px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-full hover:bg-indigo-100 transition-colors border border-indigo-100 flex items-center gap-1"
          >
            <Sparkles className="w-3 h-3" />
            {q}
          </button>
        ))}
      </div>
    );
  };

  if (mode === 'embedded') {
    return (
      <div className="flex flex-col h-full w-full overflow-hidden bg-stone-50">
        {/* Header */}
        <div className="p-3 bg-stone-100 border-b border-stone-200 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-indigo-600" />
            <span className="font-bold text-sm text-stone-700">
              {targetCard ? (language === 'zh' ? '卡片助手' : 'Card Assistant') : 'AI Assistant'}
            </span>
          </div>
          {targetCard && onClearTarget && (
            <button
              onClick={onClearTarget}
              className="text-xs text-stone-500 hover:text-indigo-600"
            >
              {language === 'zh' ? '切换到全局' : 'Switch to Global'}
            </button>
          )}
        </div>

        {/* Messages - Scrollable Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex gap-3 max-w-[90%]",
                msg.role === 'user' ? "ml-auto flex-row-reverse" : ""
              )}
            >
              <div className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0",
                msg.role === 'user' ? "bg-stone-200 text-stone-600" : "bg-indigo-100 text-indigo-600"
              )}>
                {msg.role === 'user' ? <User className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
              </div>
              <div className="flex flex-col items-start max-w-full">
                <div className={cn(
                  "p-2.5 rounded-2xl text-sm shadow-sm",
                  msg.role === 'user'
                    ? "bg-indigo-600 text-white rounded-tr-none"
                    : "bg-white text-stone-800 border border-stone-100 rounded-tl-none"
                )}>
                  {msg.role === 'assistant' ? renderMessageContent(msg.content) : msg.content}
                </div>
                {msg.role === 'assistant' && renderSuggestedQuestions(msg.suggestedQuestions)}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-3 max-w-[90%]">
              <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center flex-shrink-0">
                <Bot className="w-3 h-3" />
              </div>
              <div className="bg-white p-2.5 rounded-2xl rounded-tl-none border border-stone-100 shadow-sm">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input - Fixed at Bottom */}
        <div className="flex-shrink-0 p-3 bg-white border-t border-stone-200">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex flex-col gap-2"
          >
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={language === 'zh' ? "针对此卡片提问..." : "Ask about this card..."}
                className="flex-1 px-3 py-2 bg-stone-100 rounded-lg border-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>

            {/* Search Toggle */}
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => setEnableSearch(!enableSearch)}
                className={cn(
                  "flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors",
                  enableSearch
                    ? "bg-blue-100 text-blue-700"
                    : "text-stone-400 hover:text-stone-600 hover:bg-stone-100"
                )}
              >
                <Globe className="w-3 h-3" />
                {language === 'zh' ? '联网搜索' : 'Internet Search'}
                {enableSearch && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 ml-0.5" />}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* FAB */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => onToggle(true)}
        className="fixed bottom-6 right-6 z-[100] w-14 h-14 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-full shadow-lg flex items-center justify-center hover:shadow-xl transition-shadow"
      >
        <Sparkles className="w-6 h-6" />
      </motion.button>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
              width: isMaximized ? "90vw" : "24rem",
              height: isMaximized ? "85vh" : "500px",
              right: isMaximized ? "5vw" : "1.5rem",
              bottom: isMaximized ? "5vh" : "6rem"
            }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed z-[101] bg-white rounded-2xl shadow-2xl border border-stone-200 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2 overflow-hidden">
                {targetCard ? (
                  <>
                    <button
                      onClick={onClearTarget}
                      className="p-1 hover:bg-white/20 rounded-full transition-colors mr-1"
                      title={language === 'zh' ? "返回全局助手" : "Back to Global Assistant"}
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div className="flex flex-col overflow-hidden">
                      <span className="font-bold text-sm truncate">{targetCard.title}</span>
                      <span className="text-xs opacity-80 truncate">{language === 'zh' ? '深度对话中...' : 'Deep Dive Mode'}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <Bot className="w-5 h-5 flex-shrink-0" />
                    <span className="font-bold truncate">AI Knowledge Assistant</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsMaximized(!isMaximized)}
                  className="p-1 hover:bg-white/20 rounded-full transition-colors flex-shrink-0"
                  title={isMaximized ? (language === 'zh' ? "恢复小窗" : "Restore") : (language === 'zh' ? "最大化" : "Maximize")}
                >
                  {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
                <button onClick={() => onToggle(false)} className="p-1 hover:bg-white/20 rounded-full transition-colors flex-shrink-0">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-stone-50">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex gap-3 max-w-[85%]",
                    msg.role === 'user' ? "ml-auto flex-row-reverse" : ""
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                    msg.role === 'user' ? "bg-stone-200 text-stone-600" : "bg-indigo-100 text-indigo-600"
                  )}>
                    {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>
                  <div className="flex flex-col items-start max-w-full">
                    <div className={cn(
                      "p-3 rounded-2xl text-sm shadow-sm",
                      msg.role === 'user'
                        ? "bg-indigo-600 text-white rounded-tr-none"
                        : "bg-white text-stone-800 border border-stone-100 rounded-tl-none"
                    )}>
                      {msg.role === 'assistant' ? renderMessageContent(msg.content) : msg.content}
                    </div>
                    {msg.role === 'assistant' && renderSuggestedQuestions(msg.suggestedQuestions)}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-3 max-w-[85%]">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="bg-white p-3 rounded-2xl rounded-tl-none border border-stone-100 shadow-sm">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 bg-white border-t border-stone-100">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="flex flex-col gap-2"
              >
                <div className="flex items-center gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={language === 'zh' ? "问点什么..." : "Ask anything..."}
                    className="flex-1 px-4 py-2 bg-stone-100 rounded-full border-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || isLoading}
                    className="p-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>

                {/* Search Toggle */}
                <div className="flex items-center px-1">
                  <button
                    type="button"
                    onClick={() => setEnableSearch(!enableSearch)}
                    className={cn(
                      "flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors",
                      enableSearch
                        ? "bg-blue-100 text-blue-700"
                        : "text-stone-400 hover:text-stone-600 hover:bg-stone-100"
                    )}
                  >
                    <Globe className="w-3 h-3" />
                    {language === 'zh' ? '联网搜索' : 'Internet Search'}
                    {enableSearch && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 ml-0.5" />}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
});

function BookOpenIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}
