import { useState, useEffect, useMemo, useCallback, lazy, Suspense } from "react";
import { v4 as uuidv4 } from "uuid";
import { Sidebar, ViewType } from "@/components/Sidebar";
import { InputArea } from "@/components/InputArea";
import { CardList } from "@/components/CardList";
import { KnowledgeDetailModal } from "@/components/KnowledgeDetailModal";
import { KnowledgeGraph } from "@/components/KnowledgeGraph";
const InteractiveGraph = lazy(() => import("@/components/InteractiveGraph").then(m => ({ default: m.InteractiveGraph })));
const WhiteboardView = lazy(() => import("@/components/WhiteboardView").then(m => ({ default: m.WhiteboardView })));
import { KnowledgeCard, Category, ChatMessage } from "@/types";
import { Menu, Layers, Sparkles, Trash2, LogOut, User } from "lucide-react";
import { LanguageProvider, useLanguage } from "@/contexts/LanguageContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AuthPage } from "@/components/AuthPage";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "motion/react";
import { exportAllCards } from "@/services/export";
import { GlobalChat } from "@/components/GlobalChat";
import { cardsApi, categoriesApi, aiApi, proxyApi } from "@/services/api";

const DEFAULT_CATEGORIES = ['📚 知识库', '💼 工作', '🚀 个人成长', '🎨 生活', '📥 未分类'];

function AppContent() {
  const { user, loading: authLoading } = useAuth();

  // 未登录 → 显示登录页
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F7F6F3] flex items-center justify-center">
        <div className="text-stone-400 text-lg">加载中...</div>
      </div>
    );
  }
  if (!user) return <AuthPage />;

  return <MainApp />;
}

function MainApp() {
  const { user, signOut } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);

  // State: 从 API 加载
  const [cards, setCards] = useState<KnowledgeCard[]>([]);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [isLoading, setIsLoading] = useState(true);

  // Generate Tags (Memoized)
  const tags = useMemo(() => {
    const allTags = cards.flatMap(c => c.tags || []);
    const tagCounts: Record<string, number> = {};
    allTags.forEach(tag => {
      const normalizedTag = tag.trim();
      if (normalizedTag) {
        tagCounts[normalizedTag] = (tagCounts[normalizedTag] || 0) + 1;
      }
    });

    return Object.entries(tagCounts)
      .map(([name, count]) => ({ id: name, name, count }))
      .sort((a, b) => b.count - a.count);
  }, [cards]);

  // New View State
  const [activeView, setActiveView] = useState<ViewType>('smart');
  const [activeId, setActiveId] = useState('all');

  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isGraphViewOpen, setIsGraphViewOpen] = useState(false);
  const [isBoardViewOpen, setIsBoardViewOpen] = useState(false);

  // Global Chat State
  const [isGlobalChatOpen, setIsGlobalChatOpen] = useState(false);
  const [chatTargetCard, setChatTargetCard] = useState<KnowledgeCard | null>(null);

  // Detail Modal State
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [detailCard, setDetailCard] = useState<KnowledgeCard | null>(null);

  const { language, t } = useLanguage();

  // ===== 初始化：从后端 API 加载数据 =====
  useEffect(() => {
    async function loadData() {
      try {
        const [cardsData, catsData] = await Promise.all([
          cardsApi.list(),
          categoriesApi.list(),
        ]);
        setCards(cardsData);
        if (catsData.length > 0) {
          setCategories(catsData.map((c: any) => c.name));
        }

        // === 数据迁移：首次登录同步 localStorage ===
        const localCards = localStorage.getItem('knowledge-cards-v2');
        if (localCards && cardsData.length === 0) {
          try {
            const parsed = JSON.parse(localCards);
            if (parsed.length > 0) {
              setNotification({ message: '🔄 正在同步本地历史数据到云端...', type: 'info' });
              for (const card of parsed) {
                await cardsApi.create(card);
              }
              localStorage.removeItem('knowledge-cards-v2');
              localStorage.removeItem('knowledge-categories');
              // 重新加载
              const refreshed = await cardsApi.list();
              setCards(refreshed);
              setNotification({ message: '✅ 本地数据已成功同步到云端！', type: 'success' });
            }
          } catch (e) {
            console.error('Migration failed:', e);
          }
        }
      } catch (error) {
        console.error('Failed to load data from API:', error);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [user]);

  // Generate Tags
  // Removed useEffect for tags, replaced with useMemo above

  // Category Management Handlers
  const handleCreateCategory = async (name: string) => {
    if (!categories.includes(name)) {
      try {
        await categoriesApi.create(name);
        setCategories(prev => [...prev, name]);
        setNotification({ message: language === 'zh' ? "✅ 分类已创建" : "✅ Category created", type: 'success' });
      } catch (e: any) { console.error(e); }
    }
  };

  const handleRenameCategory = async (oldName: string, newName: string) => {
    if (categories.includes(newName)) {
      alert(language === 'zh' ? "分类名称已存在" : "Category name already exists");
      return;
    }
    try {
      // 找到分类 ID 然后重命名
      const all = await categoriesApi.list();
      const cat = all.find((c: any) => c.name === oldName);
      if (cat) await categoriesApi.rename(cat.id, newName);
      setCategories(prev => prev.map(c => c === oldName ? newName : c));
      setCards(prev => prev.map(c => c.category === oldName ? { ...c, category: newName } : c));
    } catch (e: any) { console.error(e); }
  };

  const handleDeleteCategory = async (name: string) => {
    const fallbackCategory = language === 'zh' ? '📥 未分类' : '📥 Uncategorized';
    if (!window.confirm(language === 'zh' ? `确定要删除分类 "${name}" 吗？` : `Delete category "${name}"?`)) return;

    try {
      const all = await categoriesApi.list();
      const cat = all.find((c: any) => c.name === name);
      if (cat) await categoriesApi.delete(cat.id, fallbackCategory);

      let newCategories = categories.filter(c => c !== name);
      const hasCards = cards.some(c => c.category === name);
      if (hasCards && !newCategories.includes(fallbackCategory)) newCategories.push(fallbackCategory);
      setCategories(newCategories);
      setCards(prev => prev.map(c => c.category === name ? { ...c, category: fallbackCategory } : c));
      if (activeView === 'folder' && activeId === name) { setActiveView('smart'); setActiveId('all'); }
      setNotification({ message: language === 'zh' ? "✅ 分类已删除" : "✅ Category deleted", type: 'success' });
    } catch (e: any) { console.error(e); }
  };

  const handleMoveCard = async (cardId: string, newCategory: string) => {
    try {
      await cardsApi.update(cardId, { category: newCategory });
      setCards(prev => prev.map(c => c.id === cardId ? { ...c, category: newCategory } : c));
      setNotification({ message: language === 'zh' ? "✅ 卡片已移动" : "✅ Card moved", type: 'success' });
    } catch (e: any) { console.error(e); }
  };

  const handleToggleStar = async (cardId: string) => {
    try {
      await cardsApi.toggleStar(cardId);
      setCards(prev => prev.map(c => c.id === cardId ? { ...c, isStarred: !c.isStarred } : c));
    } catch (e: any) { console.error(e); }
  };

  const handleSaveLayout = async (id: string, x: number, y: number) => {
    try {
      await cardsApi.updatePosition(id, x, y);
      setCards(prev => prev.map(c => c.id === id ? { ...c, x, y } : c));
    } catch (e: any) { console.error(e); }
  };

  const handleSynthesize = async (text: string, images: string[], sourceUrl?: string, pdfFileId?: string) => {
    setIsSynthesizing(true);

    let contentToAnalyze = text;
    let finalSourceUrl = sourceUrl;
    let isVideo = false;

    if (sourceUrl) {
      const videoDomains = ['youtube.com', 'youtu.be', 'bilibili.com', 'douyin.com'];
      if (videoDomains.some(d => sourceUrl.includes(d))) isVideo = true;
    }

    // 通过后端代理抓取链接内容
    if (sourceUrl && text.length < 500 && images.length === 0) {
      setNotification({ message: language === 'zh' ? "🔗 正在解析链接内容..." : "🔗 Parsing link content...", type: 'info' });
      try {
        const { content: fetchedText } = await proxyApi.reader(sourceUrl);
        if (fetchedText.includes('Access Denied') || fetchedText.includes('验证码')) {
          setNotification({ message: language === 'zh' ? "⚠️ 反爬虫限制，建议手动复制内容" : "⚠️ Anti-crawling detected", type: 'error' });
          setIsSynthesizing(false); return;
        }
        if (!fetchedText || fetchedText.length < 50) throw new Error('Content too short');
        contentToAnalyze = fetchedText;
        finalSourceUrl = sourceUrl;
        setNotification({ message: language === 'zh' ? "🤖 AI 正在整理..." : "🤖 AI is organizing...", type: 'info' });
      } catch (error) {
        console.error('Link parsing failed:', error);
        setNotification({ message: language === 'zh' ? "⚠️ 链接解析失败" : "⚠️ Link parsing failed", type: 'error' });
        setIsSynthesizing(false); return;
      }
    }

    try {
      const existingTitles = cards.map(c => c.title);
      // 通过后端 AI 代理合成
      const result = await aiApi.synthesize({
        text: contentToAnalyze, images, language, existingTitles, existingCategories: categories, isVideo,
      });

      if (result.category && !categories.includes(result.category)) {
        setCategories(prev => [...prev, result.category]);
      }

      // 创建卡片到后端数据库
      const newCard = await cardsApi.create({
        title: result.title, mainEntity: result.mainEntity, coreConcept: result.coreConcept,
        index: result.index, fullMarkdown: result.fullMarkdown, mindmap: result.mindmap,
        actionItems: result.actionItems, tags: result.tags, category: result.category,
        images, sourceUrl: finalSourceUrl,
        sourceType: pdfFileId ? 'pdf' : (finalSourceUrl ? 'url' : 'text'),
      });

      setCards(prev => [newCard, ...prev]);
    } catch (error) {
      console.error('Failed to synthesize:', error);
      alert('Failed to synthesize knowledge. Please try again.');
    } finally {
      setIsSynthesizing(false);
    }
  };

  const handleDeleteCard = async (cardId: string) => {
    if (window.confirm(language === 'zh' ? '确定要删除这条知识吗？' : 'Are you sure you want to delete this card?')) {
      try {
        await cardsApi.delete(cardId);
        setCards(prev => prev.filter(c => c.id !== cardId));
        if (detailCard?.id === cardId) { setIsDetailModalOpen(false); setDetailCard(null); }
        setNotification({ message: language === 'zh' ? "🗑️ 卡片已删除" : "🗑️ Card deleted", type: 'success' });
      } catch (e: any) { console.error(e); }
    }
  };

  const handleUpdateCard = async (cardId: string, updates: Partial<KnowledgeCard>) => {
    try {
      await cardsApi.update(cardId, updates);
      setCards(prev => prev.map(c => c.id === cardId ? { ...c, ...updates } : c));
      if (detailCard?.id === cardId) {
        setDetailCard(prev => prev ? { ...prev, ...updates } : null);
      }
    } catch (e: any) { console.error(e); }
  };

  const handleOpenDetail = (card: KnowledgeCard) => {
    setDetailCard(card);
    setIsDetailModalOpen(true);
  };

  const handleDeepDive = (card: KnowledgeCard) => {
    setChatTargetCard(card);
    setIsGlobalChatOpen(true);
  };

  const handleToggleActionItem = async (cardId: string, itemIndex: number) => {
    const card = cards.find(c => c.id === cardId);
    if (!card?.actionItems?.[itemIndex]) return;
    const actionItem = card.actionItems[itemIndex];
    try {
      if (actionItem.id) {
        await cardsApi.toggleAction(cardId, actionItem.id);
      }
      setCards(prev => prev.map(c => {
        if (c.id === cardId && c.actionItems) {
          const newItems = [...c.actionItems];
          newItems[itemIndex] = { ...newItems[itemIndex], completed: !newItems[itemIndex].completed };
          return { ...c, actionItems: newItems };
        }
        return c;
      }));
    } catch (e: any) { console.error(e); }
  };

  // Filter Logic (Memoized)
  const filteredCards = useMemo(() => {
    return cards.filter(c => {
      let matchesView = true;

      if (activeView === 'smart') {
        if (activeId === 'today') {
          const today = new Date().setHours(0, 0, 0, 0);
          const cardDate = new Date(c.createdAt).setHours(0, 0, 0, 0);
          matchesView = cardDate === today;
        } else if (activeId === 'starred') {
          matchesView = !!c.isStarred;
        }
        // 'all' matches everything
      } else if (activeView === 'folder') {
        matchesView = c.category === activeId;
      } else if (activeView === 'tag') {
        matchesView = c.tags?.includes(activeId) || false;
      }

      let matchesSearch = true;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        matchesSearch =
          c.title.toLowerCase().includes(query) ||
          c.category.toLowerCase().includes(query) ||
          (c.tags && c.tags.some(tag => tag.toLowerCase().includes(query))) ||
          (c.fullMarkdown && c.fullMarkdown.toLowerCase().includes(query));
      }

      return matchesView && matchesSearch;
    });
  }, [cards, activeView, activeId, searchQuery]);

  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const handleMerge = async () => {
    if (filteredCards.length < 2) return;
    setNotification({ message: language === 'zh' ? '🧬 正在进行知识融合...' : '🧬 Merging knowledge...', type: 'info' });
    setIsMerging(true);
    try {
      const existingTitles = cards.map(c => c.title);
      // 通过后端 AI 代理缝合
      const mergedResults = await aiApi.merge({ cards: filteredCards, language, existingTitles });

      const newCardsList: KnowledgeCard[] = [];
      const processedOriginalIds = new Set<string>();

      for (const res of mergedResults) {
        if (res.originalId) {
          const originalCard = cards.find(c => c.id === res.originalId);
          if (originalCard) { newCardsList.push(originalCard); processedOriginalIds.add(res.originalId); }
        } else if (res.mergedFromIds && res.mergedFromIds.length > 0) {
          const sourceCards = cards.filter(c => res.mergedFromIds.includes(c.id));
          const uniqueImages = Array.from(new Set(sourceCards.flatMap(c => c.images || [])));
          const originalSourceCards = JSON.parse(JSON.stringify(sourceCards));

          // 创建合并卡片到后端
          const newCard = await cardsApi.create({
            title: res.title, mainEntity: res.mainEntity, coreConcept: res.coreConcept,
            index: res.index, fullMarkdown: res.fullMarkdown, mindmap: res.mindmap,
            actionItems: res.actionItems ? res.actionItems.map((text: string) => ({ text, completed: false })) : [],
            tags: res.tags, category: res.category, images: uniqueImages,
            mergedCount: sourceCards.reduce((acc: number, c: any) => acc + (c.mergedCount || 1), 0),
            sourceCardIds: sourceCards.map(c => c.id),
            originalSourceCards: originalSourceCards,
          });
          newCardsList.push(newCard);
          res.mergedFromIds.forEach((id: string) => processedOriginalIds.add(id));
        }
      }

      // 删除已合并的原始卡片
      for (const id of processedOriginalIds) {
        if (!newCardsList.find(c => c.id === id)) {
          await cardsApi.delete(id).catch(() => { });
        }
      }

      const cardsNotInFilter = cards.filter(c => !filteredCards.find(fc => fc.id === c.id));
      setCards([...newCardsList, ...cardsNotInFilter]);
      setNotification({ message: language === 'zh' ? '✅ 知识融合完成！' : '✅ Knowledge merge complete!', type: 'success' });
    } catch (error) {
      console.error('Merge failed:', error);
      setNotification({ message: language === 'zh' ? '❌ 融合失败' : '❌ Merge failed', type: 'error' });
    } finally {
      setIsMerging(false);
    }
  };

  const handleDissolve = async (card: KnowledgeCard) => {
    // 1. Check for original source cards
    let cardsToRestore = card.originalSourceCards;

    if (!cardsToRestore || cardsToRestore.length === 0) {
      cardsToRestore = card.sourceCards;
    }

    if (!cardsToRestore || cardsToRestore.length === 0) {
      alert(language === 'zh' ? '无法恢复：原始卡片数据已丢失' : 'Cannot restore: Original card data lost');
      handleDeleteCard(card.id);
      return;
    }

    if (window.confirm(language === 'zh' ? '确定要解散这个合集吗？原卡片将恢复。' : 'Are you sure you want to dissolve this collection? Originals will be restored.')) {
      try {
        // 后端：删除合并卡片
        await cardsApi.delete(card.id);

        // 后端：重新创建原始卡片
        const restoredCards: KnowledgeCard[] = [];
        for (const original of cardsToRestore) {
          const created = await cardsApi.create({
            title: original.title, mainEntity: original.mainEntity,
            coreConcept: original.coreConcept, index: original.index,
            fullMarkdown: original.fullMarkdown, mindmap: original.mindmap,
            actionItems: original.actionItems || [], tags: original.tags || [],
            category: original.category, images: original.images || [],
            sourceUrl: original.sourceUrl, sourceType: original.sourceType,
            isStarred: original.isStarred, createdAt: original.createdAt,
          });
          restoredCards.push(created);
        }

        // 本地：替换合并卡片为恢复的卡片
        setCards(prev => {
          const remaining = prev.filter(c => c.id !== card.id);
          return [...remaining, ...restoredCards].sort((a, b) => b.createdAt - a.createdAt);
        });

        if (detailCard?.id === card.id) {
          setIsDetailModalOpen(false);
          setDetailCard(null);
        }

        setNotification({ message: language === 'zh' ? "✅ 已恢复原卡片" : "✅ Original cards restored", type: 'success' });
      } catch (e: any) {
        console.error('Dissolve failed:', e);
        setNotification({ message: language === 'zh' ? '❌ 解散失败' : '❌ Dissolve failed', type: 'error' });
      }
    }
  };

  // Display Name Logic
  let displayTitle = "";
  if (activeView === 'smart') {
    if (activeId === 'all') displayTitle = language === 'zh' ? '所有卡片' : 'All Cards';
    else if (activeId === 'today') displayTitle = language === 'zh' ? '今天' : 'Today';
    else if (activeId === 'starred') displayTitle = language === 'zh' ? '星标' : 'Starred';
  } else if (activeView === 'folder') {
    displayTitle = `📁 ${activeId}`;
  } else if (activeView === 'tag') {
    displayTitle = `# ${activeId}`;
  }

  const handleExportAll = async () => {
    if (cards.length === 0) {
      setNotification({
        message: language === 'zh' ? "没有可导出的卡片" : "No cards to export",
        type: 'info'
      });
      return;
    }

    setNotification({
      message: language === 'zh' ? "📦 正在打包导出..." : "📦 Packaging for export...",
      type: 'info'
    });

    try {
      await exportAllCards(cards);
      setNotification({
        message: language === 'zh' ? "✅ 导出成功" : "✅ Export successful",
        type: 'success'
      });
    } catch (error) {
      console.error("Export failed:", error);
      setNotification({
        message: language === 'zh' ? "❌ 导出失败" : "❌ Export failed",
        type: 'error'
      });
    }
  };

  // Calculate category counts (memoized)
  const categoryCounts = useMemo(() => cards.reduce((acc, card) => {
    const cat = card.category || (language === 'zh' ? '📥 未分类' : '📥 Uncategorized');
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {} as Record<string, number>), [cards, language]);

  // Memoized Sidebar callbacks
  const handleSidebarSelect = useCallback((view: any, id: string) => {
    setActiveView(view);
    setActiveId(id);
    setIsGraphViewOpen(false);
    setIsBoardViewOpen(false);
  }, []);
  const handleToggleGraphView = useCallback(() => {
    setIsGraphViewOpen(prev => !prev);
    setIsBoardViewOpen(false);
  }, []);
  const handleToggleBoardView = useCallback(() => {
    setIsBoardViewOpen(prev => !prev);
    setIsGraphViewOpen(false);
  }, []);

  return (
    <div className="min-h-screen bg-[#F7F6F3] text-stone-900 font-sans">
      <Sidebar
        categories={categories}
        tags={tags}
        activeView={activeView}
        activeId={activeId}
        onSelect={handleSidebarSelect}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        isGraphViewOpen={isGraphViewOpen}
        onToggleGraphView={handleToggleGraphView}
        isBoardViewOpen={isBoardViewOpen}
        onToggleBoardView={handleToggleBoardView}
        onCreateCategory={handleCreateCategory}
        onRenameCategory={handleRenameCategory}
        onDeleteCategory={handleDeleteCategory}
        onExportAll={handleExportAll}
        categoryCounts={categoryCounts}
      />

      {/* Mobile Header */}
      <div className="md:hidden flex items-center p-4 bg-white border-b border-stone-200 sticky top-0 z-20">
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 -ml-2">
          <Menu className="w-6 h-6" />
        </button>
        <span className="font-bold ml-2">{t('app.title')}</span>
      </div>

      {/* 用户头像菜单 */}
      <div className="fixed top-4 right-4 z-50">
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 px-3 py-2 bg-white rounded-full shadow-md border border-stone-200 hover:shadow-lg transition-all text-sm"
          >
            <div className="w-7 h-7 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
            <span className="hidden sm:inline text-stone-600 max-w-[120px] truncate">{user?.email}</span>
          </button>
          {showUserMenu && (
            <>
              <div className="fixed inset-0" onClick={() => setShowUserMenu(false)} />
              <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-stone-100 py-2 z-50">
                <div className="px-4 py-2 text-xs text-stone-400 border-b border-stone-100">
                  {user?.email}
                </div>
                <button
                  onClick={() => { signOut(); setShowUserMenu(false); }}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  退出登录
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <main className="md:pl-64 min-h-screen transition-all duration-300 relative">
        {/* Notification Toast */}
        <AnimatePresence>
          {notification && (
            <motion.div
              initial={{ opacity: 0, y: -20, x: "-50%" }}
              animate={{ opacity: 1, y: 0, x: "-50%" }}
              exit={{ opacity: 0, y: -20, x: "-50%" }}
              className={cn(
                "fixed top-4 left-1/2 md:left-[calc(50%+8rem)] z-50 px-6 py-3 rounded-full shadow-lg text-sm font-medium flex items-center gap-2",
                notification.type === 'error' ? "bg-red-500 text-white" :
                  notification.type === 'success' ? "bg-green-500 text-white" :
                    "bg-stone-900 text-white"
              )}
            >
              <span>{notification.message}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 h-screen flex flex-col">
          {isGraphViewOpen ? (
            <div className="flex-1 h-screen overflow-hidden -mx-4 sm:-mx-6 lg:-mx-8">
              <Suspense fallback={<div className="flex items-center justify-center h-full text-stone-400">Loading Graph...</div>}>
                <InteractiveGraph
                  cards={cards}
                  onNodeClick={(card) => handleOpenDetail(card)}
                />
              </Suspense>
            </div>
          ) : isBoardViewOpen ? (
            <div className="flex-1 h-screen overflow-hidden -mx-4 sm:-mx-6 lg:-mx-8">
              <Suspense fallback={<div className="flex items-center justify-center h-full text-stone-400">Loading Board...</div>}>
                <WhiteboardView />
              </Suspense>
            </div>
          ) : (
            <>
              <InputArea
                onSynthesize={handleSynthesize}
                isSynthesizing={isSynthesizing}
              />

              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-stone-800 flex items-center gap-2">
                  {displayTitle}
                  <span className="text-sm font-normal text-stone-400 ml-2">
                    {filteredCards.length} {t('card.items')}
                  </span>
                </h2>

                <div className="flex items-center gap-3">
                  {/* Merge Button */}
                  {filteredCards.length > 1 && (
                    <button
                      onClick={handleMerge}
                      disabled={isMerging}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold text-white transition-all shadow-md hover:shadow-lg",
                        isMerging
                          ? "bg-purple-400 cursor-not-allowed"
                          : "bg-gradient-to-r from-purple-600 to-indigo-600 hover:scale-105"
                      )}
                    >
                      {isMerging ? (
                        <Sparkles className="w-4 h-4 animate-spin" />
                      ) : (
                        <Layers className="w-4 h-4" />
                      )}
                      {language === 'zh' ? '🧬 知识缝合' : '🧬 Merge Knowledge'}
                    </button>
                  )}
                </div>
              </div>

              <CardList
                cards={filteredCards}
                onOpenDetail={handleOpenDetail}
                onToggleActionItem={handleToggleActionItem}
                isFiltered={activeView !== 'smart' || activeId !== 'all' || searchQuery.trim().length > 0}
                onMoveCard={handleMoveCard}
                onToggleStar={handleToggleStar}
                onDeleteCard={handleDeleteCard}
                onUpdateCard={handleUpdateCard}
                onUnmerge={handleDissolve}
                categories={categories}
              />
            </>
          )}
        </div>
      </main>

      {/* Detail Modal */}
      <KnowledgeDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        card={detailCard}
        allCards={cards}
        onChat={() => detailCard && handleDeepDive(detailCard)}
        onNavigateToCard={setDetailCard}
        onDeleteCard={handleDeleteCard}
        onUpdateCard={handleUpdateCard}
        onUnmerge={handleDissolve}
        onMoveCard={handleMoveCard}
        onToggleStar={handleToggleStar}
        categories={categories}
      />

      {/* Global AI Chat (Integrated) */}
      {!isDetailModalOpen && (
        <GlobalChat
          cards={cards}
          onOpenDetail={handleOpenDetail}
          isOpen={isGlobalChatOpen}
          onToggle={setIsGlobalChatOpen}
          targetCard={chatTargetCard}
          onClearTarget={() => setChatTargetCard(null)}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <AppContent />
      </LanguageProvider>
    </AuthProvider>
  );
}
