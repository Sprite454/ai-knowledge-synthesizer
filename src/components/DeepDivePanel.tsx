import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Globe, Loader2, Send, Bot, User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { KnowledgeCard, ChatMessage } from "@/types";
import { useLanguage } from "@/contexts/LanguageContext";
import { aiApi } from "@/services/api";

interface DeepDivePanelProps {
  isOpen: boolean;
  onClose: () => void;
  card: KnowledgeCard | null;
  onUpdateChatHistory: (cardId: string, messages: ChatMessage[]) => void;
}

// AI calls now go through backend proxy

export function DeepDivePanel({ isOpen, onClose, card, onUpdateChatHistory }: DeepDivePanelProps) {
  const { t, language } = useLanguage();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize chat when panel opens with a new card
  useEffect(() => {
    if (isOpen && card) {
      if (card.chatHistory && card.chatHistory.length > 0) {
        setMessages(card.chatHistory);
      } else {
        const initialMessage: ChatMessage = {
          id: 'init',
          role: 'assistant',
          content: language === 'zh'
            ? `关于《${card.title}》，你想让我为你搜索真实案例，还是制定具体的学习计划？`
            : `Regarding "${card.title}", would you like me to search for real cases or create a specific study plan?`,
          timestamp: Date.now()
        };
        setMessages([initialMessage]);
        // Save initial message immediately
        onUpdateChatHistory(card.id, [initialMessage]);
      }
    }
  }, [isOpen, card?.id]); // Only reset when card ID changes or panel opens

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || !card) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      timestamp: Date.now()
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    onUpdateChatHistory(card.id, newMessages); // Persist user message

    setInputValue("");
    setIsLoading(true);

    try {
      // Construct context from card
      const context = `
        Current Topic: ${card.title}
        Core Concept: ${card.coreConcept}
        Tags: ${card.tags.join(", ")}
      `;

      // 通过后端 AI 代理发送对话
      const { content: responseText } = await aiApi.chat({
        messages: newMessages,
        context,
        language,
        enableSearch: true,
      });

      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: responseText,
        timestamp: Date.now()
      };

      const updatedMessages = [...newMessages, botMsg];
      setMessages(updatedMessages);
      onUpdateChatHistory(card.id, updatedMessages); // Persist bot response

    } catch (error) {
      console.error("Chat error:", error);
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: language === 'zh' ? "抱歉，发生了错误，请稍后再试。" : "Sorry, an error occurred. Please try again.",
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
          />

          {/* Panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-md md:max-w-lg lg:max-w-xl bg-white shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 bg-white/80 backdrop-blur-md sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-semibold text-stone-900">{t('deepDive.title')}</h2>
                  <p className="text-xs text-stone-500 truncate max-w-[200px]">
                    {card?.title}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-stone-50/50">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-stone-900 text-white' : 'bg-indigo-100 text-indigo-600'
                    }`}>
                    {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>

                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${msg.role === 'user'
                      ? 'bg-stone-900 text-white rounded-tr-none'
                      : 'bg-white text-stone-800 border border-stone-100 rounded-tl-none'
                    }`}>
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="bg-white border border-stone-100 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                    <span className="text-xs text-stone-400">Thinking...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-stone-100">
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={language === 'zh' ? "输入你的问题..." : "Ask a follow-up question..."}
                  className="w-full pl-4 pr-12 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                  disabled={isLoading}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!inputValue.trim() || isLoading}
                  className="absolute right-2 p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <div className="mt-2 text-center">
                <p className="text-[10px] text-stone-400">
                  {t('deepDive.footer')}
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
