import React, { useState, memo } from "react";
import { cn } from "@/lib/utils";
import {
  LayoutGrid,
  Hash,
  Network,
  Languages,
  Search,
  Calendar,
  Star,
  Inbox,
  Folder,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  Package,
  Settings,
  Save,
  Map
} from "lucide-react";
import { Category } from "@/types";
import { useLanguage } from "@/contexts/LanguageContext";
import { motion, AnimatePresence } from "motion/react";

export type ViewType = 'smart' | 'folder' | 'tag';

interface SidebarProps {
  categories: string[]; // Just strings for folders
  tags: Category[]; // Tags with counts
  activeView: ViewType;
  activeId: string;
  onSelect: (view: ViewType, id: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  isGraphViewOpen: boolean;
  onToggleGraphView: () => void;
  onCreateCategory: (name: string) => void;
  onRenameCategory: (oldName: string, newName: string) => void;
  onDeleteCategory: (name: string) => void;
  onExportAll?: () => void;
  categoryCounts?: Record<string, number>;
  isBoardViewOpen: boolean;
  onToggleBoardView: () => void;
}

function SidebarInner({
  categories,
  tags,
  activeView,
  activeId,
  onSelect,
  searchQuery,
  onSearchChange,
  isGraphViewOpen,
  onToggleGraphView,
  onCreateCategory,
  onRenameCategory,
  onDeleteCategory,
  onExportAll,
  categoryCounts = {},
  isBoardViewOpen,
  onToggleBoardView
}: SidebarProps) {
  const { t, language, setLanguage } = useLanguage();
  const [isTagsExpanded, setIsTagsExpanded] = useState(true);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [feishuWebhook, setFeishuWebhook] = useState(() => localStorage.getItem('feishu-webhook') || "");
  const [aiProvider, setAiProvider] = useState(() => localStorage.getItem('ai-provider') || "deepseek");

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'zh' : 'en');
  };

  const handleCreateClick = () => {
    const name = prompt(language === 'zh' ? "请输入新分类名称" : "Enter new category name");
    if (name && name.trim()) {
      onCreateCategory(name.trim());
    }
  };

  const handleRenameClick = (oldName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newName = prompt(language === 'zh' ? "重命名分类" : "Rename category", oldName);
    if (newName && newName.trim() && newName !== oldName) {
      onRenameCategory(oldName, newName.trim());
    }
  };

  const handleDeleteClick = (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onDeleteCategory(name);
  };

  const handleSaveWebhook = () => {
    localStorage.setItem('feishu-webhook', feishuWebhook);
    localStorage.setItem('ai-provider', aiProvider);
    alert(language === 'zh' ? "设置已保存" : "Settings saved");
    setIsSettingsOpen(false);
  };

  return (
    <div className="w-64 bg-stone-50 border-r border-stone-200 h-screen flex flex-col fixed left-0 top-0 hidden md:flex z-50">
      {/* Header */}
      <div className="p-4 pb-2">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-stone-900 flex items-center gap-2">
            <span className="w-8 h-8 bg-black text-white rounded-lg flex items-center justify-center text-sm">AI</span>
            {language === 'zh' ? '合成器' : 'Synthesizer'}
          </h1>
        </div>

        {/* Global Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={language === 'zh' ? '搜索...' : 'Search...'}
            className="w-full pl-9 pr-4 py-2 bg-white border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 space-y-6">

        {/* Section A: Smart Views */}
        <div className="space-y-1">
          <div className="px-2 text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">
            {language === 'zh' ? '智能视图' : 'Smart Views'}
          </div>

          <SidebarItem
            icon={LayoutGrid}
            label={language === 'zh' ? '所有卡片' : 'All Cards'}
            isActive={activeView === 'smart' && activeId === 'all' && !isGraphViewOpen}
            onClick={() => onSelect('smart', 'all')}
          />
          <SidebarItem
            icon={Calendar}
            label={language === 'zh' ? '今天' : 'Today'}
            isActive={activeView === 'smart' && activeId === 'today' && !isGraphViewOpen}
            onClick={() => onSelect('smart', 'today')}
          />
          <SidebarItem
            icon={Star}
            label={language === 'zh' ? '星标' : 'Starred'}
            isActive={activeView === 'smart' && activeId === 'starred' && !isGraphViewOpen}
            onClick={() => onSelect('smart', 'starred')}
          />
          <SidebarItem
            icon={Network}
            label={language === 'zh' ? '知识星图' : 'Knowledge Graph'}
            isActive={isGraphViewOpen}
            onClick={onToggleGraphView}
            className={isGraphViewOpen ? "bg-indigo-50 text-indigo-700 font-medium" : ""}
          />
          <SidebarItem
            icon={Map}
            label={language === 'zh' ? '白板模式' : 'Board View'}
            isActive={isBoardViewOpen}
            onClick={onToggleBoardView}
            className={isBoardViewOpen ? "bg-indigo-50 text-indigo-700 font-medium" : ""}
          />
        </div>

        {/* Section B: Folders/Categories */}
        <div className="space-y-1">
          <div className="flex items-center justify-between px-2 mb-2 group">
            <div className="text-xs font-semibold text-stone-400 uppercase tracking-wider">
              {language === 'zh' ? '收藏夹' : 'Folders'}
            </div>
            <button
              onClick={handleCreateClick}
              className="p-1 text-stone-400 hover:text-stone-600 hover:bg-stone-200 rounded opacity-0 group-hover:opacity-100 transition-opacity"
              title={language === 'zh' ? '新建分类' : 'New Folder'}
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>

          {categories.map((cat) => (
            <div
              key={cat}
              className={cn(
                "group flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer",
                activeView === 'folder' && activeId === cat && !isGraphViewOpen
                  ? "bg-white text-stone-900 shadow-sm border border-stone-100 font-medium"
                  : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
              )}
              onClick={() => onSelect('folder', cat)}
            >
              <div className="flex items-center gap-3 overflow-hidden flex-1">
                <Folder className={cn("w-4 h-4 flex-shrink-0", activeView === 'folder' && activeId === cat ? "text-indigo-600" : "text-stone-400")} />
                <span className="truncate">{cat}</span>
                {categoryCounts[cat] > 0 && (
                  <span className="text-xs text-stone-400 ml-auto mr-2">{categoryCounts[cat]}</span>
                )}
              </div>

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => handleRenameClick(cat, e)}
                  className="p-1 text-stone-400 hover:text-stone-600 hover:bg-stone-200 rounded"
                >
                  <Pencil className="w-3 h-3" />
                </button>
                <button
                  onClick={(e) => handleDeleteClick(cat, e)}
                  className="p-1 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Section C: Tags */}
        <div className="space-y-1">
          <button
            onClick={() => setIsTagsExpanded(!isTagsExpanded)}
            className="w-full flex items-center justify-between px-2 mb-2 text-xs font-semibold text-stone-400 uppercase tracking-wider hover:text-stone-600"
          >
            <span>{language === 'zh' ? '标签' : 'Tags'}</span>
            {isTagsExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>

          <AnimatePresence>
            {isTagsExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="flex flex-wrap gap-2 px-2"
              >
                {tags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => onSelect('tag', tag.id)}
                    className={cn(
                      "px-2 py-1 rounded-md text-xs border transition-colors flex items-center gap-1",
                      activeView === 'tag' && activeId === tag.id && !isGraphViewOpen
                        ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                        : "bg-white border-stone-200 text-stone-600 hover:border-stone-300"
                    )}
                  >
                    <Hash className="w-3 h-3 opacity-50" />
                    <span className="max-w-[100px] truncate">{tag.name}</span>
                    <span className="text-[10px] opacity-60 ml-0.5">{tag.count}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-stone-200 space-y-2">
        {onExportAll && (
          <button
            onClick={onExportAll}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
          >
            <Package className="w-4 h-4" />
            <span>{language === 'zh' ? '导出全部知识库' : 'Export Knowledge Base'}</span>
          </button>
        )}

        {/* Settings Toggle */}
        <button
          onClick={() => setIsSettingsOpen(!isSettingsOpen)}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
        >
          <Settings className="w-4 h-4" />
          <span>{language === 'zh' ? '设置' : 'Settings'}</span>
          {isSettingsOpen ? <ChevronDown className="w-3 h-3 ml-auto" /> : <ChevronRight className="w-3 h-3 ml-auto" />}
        </button>

        {/* Settings Panel */}
        <AnimatePresence>
          {isSettingsOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="px-3 py-2 bg-stone-100 rounded-lg space-y-2 mb-2">
                <label className="text-xs font-medium text-stone-500 block mb-1">
                  {language === 'zh' ? '飞书 Webhook 地址' : 'Feishu Webhook URL'}
                </label>
                <div className="flex gap-1 mb-3">
                  <input
                    type="text"
                    value={feishuWebhook}
                    onChange={(e) => setFeishuWebhook(e.target.value)}
                    placeholder="https://open.feishu.cn/..."
                    className="flex-1 text-xs px-2 py-1 rounded border border-stone-300 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <label className="text-xs font-medium text-stone-500 block mb-1">
                  {language === 'zh' ? 'AI 模型引擎' : 'AI Model Engine'}
                </label>
                <div className="flex gap-1">
                  <select
                    value={aiProvider}
                    onChange={(e) => setAiProvider(e.target.value)}
                    className="flex-1 text-xs px-2 py-1.5 rounded border border-stone-300 focus:outline-none focus:border-indigo-500 bg-white"
                  >
                    <option value="gemini">Google Gemini 免费版 (推荐)</option>
                    <option value="deepseek">DeepSeek (国内流畅)</option>
                    <option value="kimi">Kimi (月之暗面)</option>
                  </select>
                  <button
                    onClick={handleSaveWebhook}
                    className="p-1 px-3 bg-indigo-500 text-white rounded hover:bg-indigo-600 flex items-center gap-1 text-xs font-medium"
                  >
                    <Save className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={toggleLanguage}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
        >
          <Languages className="w-4 h-4" />
          <span>{language === 'en' ? 'Switch to 中文' : '切换到 English'}</span>
        </button>
      </div>
    </div>
  );
}

function SidebarItem({ icon: Icon, label, isActive, onClick, className }: any) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
        isActive
          ? "bg-white text-stone-900 shadow-sm border border-stone-100 font-medium"
          : "text-stone-600 hover:bg-stone-100 hover:text-stone-900",
        className
      )}
    >
      <Icon className={cn("w-4 h-4", isActive ? "text-indigo-600" : "text-stone-400")} />
      <span>{label}</span>
    </button>
  );
}

export const Sidebar = memo(SidebarInner);

