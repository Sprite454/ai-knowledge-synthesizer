import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, ArrowRight, AlertCircle, Image as ImageIcon, X, Link as LinkIcon, Paperclip, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { filesApi } from "@/services/api";
import { saveFile } from "@/services/storage";

interface InputAreaProps {
  onSynthesize: (text: string, images: string[], sourceUrl?: string, pdfFileId?: string) => void;
  isSynthesizing: boolean;
}

export function InputArea({ onSynthesize, isSynthesizing }: InputAreaProps) {
  const [text, setText] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [pdfFileId, setPdfFileId] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [isParsingPdf, setIsParsingPdf] = useState(false);
  const { t, language } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const validateInput = (input: string, currentImages: string[]): boolean => {
    const trimmed = input.trim();

    // If we have images or PDF, text length requirement is relaxed
    if (currentImages.length > 0 || pdfFileId) {
      setError(null);
      return true;
    }

    // Check if input contains a URL - if so, allow it for proxy fetching
    const urlRegex = /(https?:\/\/[^\s]+)/i;
    if (urlRegex.test(trimmed)) {
      setError(null);
      return true;
    }

    if (trimmed.length < 20) {
      setError(language === 'zh'
        ? "⚠️ 内容太短，无法进行有效分析。请输入至少 20 字的详细内容或上传图片/PDF。"
        : "⚠️ Content is too short. Please enter at least 20 characters or upload an image/PDF."
      );
      return false;
    }

    setError(null);
    return true;
  };

  const handleSubmit = () => {
    if ((!text.trim() && images.length === 0 && !pdfFileId) || isSynthesizing || isParsingPdf) return;

    if (validateInput(text, images)) {
      // Extract URL from text if present
      const urlRegex = /(https?:\/\/[^\s]+)/;
      const match = text.match(urlRegex);
      const extractedUrl = match ? match[0] : undefined;

      onSynthesize(text, images, extractedUrl, pdfFileId);
      setText("");
      setImages([]);
      setPdfFileId(undefined);
      setError(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      handleSubmit();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    if (error) setError(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(Array.from(e.target.files));
    }
  };

  const handlePdfChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const validTypes = ["application/pdf", "text/markdown", "text/plain"];
      if (validTypes.includes(file.type) || file.name.endsWith('.md') || file.name.endsWith('.txt')) {
        await processDocument(file);
      }
    }
  };

  const processDocument = async (file: File) => {
    setIsParsingPdf(true);
    try {
      const fileId = await saveFile(file);
      setPdfFileId(fileId);

      const res = await filesApi.parse(file);
      const docText = res.content;
      const prefix = `[Document: ${file.name}]\n\n`;
      setText(prev => {
        const newText = prev ? prev + "\n\n" + prefix + docText : prefix + docText;
        return newText;
      });
      setError(null);
    } catch (err) {
      console.error(err);
      setError(language === 'zh' ? "文档解析失败" : "Failed to parse document");
      setPdfFileId(undefined);
    } finally {
      setIsParsingPdf(false);
      // Reset input
      if (pdfInputRef.current) pdfInputRef.current.value = "";
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    const files: File[] = [];

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        if (file) files.push(file);
      }
    }

    if (files.length > 0) {
      processFiles(files);
      e.preventDefault(); // Prevent pasting the image binary into textarea if possible
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const validDocTypes = ["application/pdf", "text/markdown", "text/plain"];
      if (validDocTypes.includes(file.type) || file.name.endsWith('.md') || file.name.endsWith('.txt')) {
        await processDocument(file);
      } else if (file.type.startsWith("image/")) {
        processFiles([file]);
      }
    }
  };

  const processFiles = (files: File[]) => {
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          setImages(prev => [...prev, e.target!.result as string]);
          setError(null); // Clear error if image is added
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="w-full max-w-3xl mx-auto mb-12">
      <div className="relative group">
        <div className={cn(
          "absolute -inset-1 rounded-2xl blur opacity-25 transition duration-1000",
          error ? "bg-red-200 opacity-50" : "bg-gradient-to-r from-indigo-100 to-purple-100 group-hover:opacity-50"
        )}></div>

        <div
          className={cn(
            "relative bg-white rounded-xl shadow-sm border overflow-hidden transition-all focus-within:shadow-md",
            error ? "border-red-300 ring-1 ring-red-100" : "border-stone-200 focus-within:border-stone-300",
            isParsingPdf && "opacity-80 pointer-events-none"
          )}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {isParsingPdf && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-2 text-indigo-600">
                <Loader2 className="w-8 h-8 animate-spin" />
                <span className="text-sm font-medium">{language === 'zh' ? '正在解析 PDF...' : 'Parsing PDF...'}</span>
              </div>
            </div>
          )}

          <textarea
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={language === 'zh' ? "粘贴文本、拖入 PDF 或截图 (Ctrl+V)..." : "Paste text, drop PDF, or screenshots (Ctrl+V)..."}
            className="w-full p-6 min-h-[100px] resize-none outline-none text-stone-700 placeholder:text-stone-400 text-lg bg-transparent"
          />

          {/* Image Previews */}
          <AnimatePresence>
            {images.length > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="px-6 pb-4 flex flex-wrap gap-3"
              >
                {images.map((img, idx) => (
                  <div key={idx} className="relative group/img">
                    <img
                      src={img}
                      alt="Preview"
                      className="h-20 w-20 object-cover rounded-lg border border-stone-200 shadow-sm"
                    />
                    <button
                      onClick={() => removeImage(idx)}
                      className="absolute -top-2 -right-2 bg-white rounded-full p-1 shadow-md border border-stone-100 text-stone-400 hover:text-red-500 transition-colors opacity-0 group-hover/img:opacity-100"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="px-6 pb-2 overflow-hidden"
              >
                <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-100">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span className="leading-snug">{error}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center justify-between px-4 py-3 bg-stone-50 border-t border-stone-100">
            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept="image/*"
                multiple
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-stone-400 hover:text-indigo-600 transition-colors p-2 rounded-md hover:bg-indigo-50"
                title={language === 'zh' ? '上传图片' : 'Upload Image'}
              >
                <ImageIcon className="w-5 h-5" />
              </button>

              <input
                type="file"
                ref={pdfInputRef}
                onChange={handlePdfChange}
                className="hidden"
                accept=".pdf,.md,.txt,application/pdf,text/markdown,text/plain"
              />
              <button
                onClick={() => pdfInputRef.current?.click()}
                className="text-stone-400 hover:text-indigo-600 transition-colors p-2 rounded-md hover:bg-indigo-50"
                title={language === 'zh' ? '上传文档/PDF' : 'Upload PDF/Doc'}
              >
                <Paperclip className="w-5 h-5" />
              </button>

              <div className="w-px h-4 bg-stone-200 mx-2" />

              <div className="text-xs text-stone-400 font-medium flex items-center gap-2">
                <span className="px-1.5 py-0.5 rounded border border-stone-200 bg-white">⌘ + Enter</span> {t('input.shortcut')}
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={(!text.trim() && images.length === 0) || isSynthesizing || isParsingPdf}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                (text.trim() || images.length > 0) && !isSynthesizing && !isParsingPdf
                  ? "bg-stone-900 text-white hover:bg-black shadow-sm hover:shadow"
                  : "bg-stone-200 text-stone-400 cursor-not-allowed"
              )}
            >
              {isSynthesizing ? (
                <>
                  <Sparkles className="w-4 h-4 animate-spin" />
                  {t('input.synthesizing')}
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  {t('input.submit')}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
