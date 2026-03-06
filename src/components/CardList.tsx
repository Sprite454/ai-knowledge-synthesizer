import { useState, memo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { KnowledgeCard } from "@/types";
import { ArrowUpRight, Tag, BookOpen, MoreHorizontal, CheckSquare, Square, Layers, X, Maximize2, ChevronDown, ChevronUp, Search, Star, FolderInput, Edit2, FileText, Trash2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface CardListProps {
  cards: KnowledgeCard[];
  onOpenDetail: (card: KnowledgeCard) => void;
  onToggleActionItem: (cardId: string, itemIndex: number) => void;
  isFiltered?: boolean;
  onMoveCard?: (cardId: string, category: string) => void;
  onToggleStar?: (cardId: string) => void;
  onDeleteCard?: (cardId: string) => void;
  onUpdateCard?: (cardId: string, updates: Partial<KnowledgeCard>) => void;
  onUnmerge?: (card: KnowledgeCard) => void;
  categories?: string[];
}

function CardListInner({ cards, onOpenDetail, onToggleActionItem, isFiltered = false, onMoveCard, onToggleStar, onDeleteCard, onUpdateCard, onUnmerge, categories = [] }: CardListProps) {
  const { t, language } = useLanguage();
  const [expandedActionCards, setExpandedActionCards] = useState<Set<string>>(new Set());
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [openCategoryMenuId, setOpenCategoryMenuId] = useState<string | null>(null);

  const toggleActionExpansion = (cardId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedActionCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(cardId)) {
        newSet.delete(cardId);
      } else {
        newSet.add(cardId);
      }
      return newSet;
    });
  };

  const handleMenuClick = (cardId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenMenuId(openMenuId === cardId ? null : cardId);
    setOpenCategoryMenuId(null); // Close other menu
  };

  const handleCategoryClick = (cardId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenCategoryMenuId(openCategoryMenuId === cardId ? null : cardId);
    setOpenMenuId(null); // Close other menu
  };

  // Close menus when clicking outside (handled by backdrop)
  const closeAllMenus = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenMenuId(null);
    setOpenCategoryMenuId(null);
  };

  const handleRename = (card: KnowledgeCard) => {
    const newTitle = window.prompt(language === 'zh' ? "重命名标题" : "Rename Title", card.title);
    if (newTitle && newTitle.trim() !== "" && onUpdateCard) {
      onUpdateCard(card.id, { title: newTitle });
    }
    setOpenMenuId(null);
  };

  const handleEditSummary = (card: KnowledgeCard) => {
    // Join existing index items for editing
    const currentSummary = (card.index || []).join('\n');
    const newSummary = window.prompt(language === 'zh' ? "编辑摘要 (每行一句)" : "Edit Summary (One per line)", currentSummary);
    if (newSummary !== null && onUpdateCard) {
      const newIndex = newSummary.split('\n').filter(line => line.trim() !== "");
      onUpdateCard(card.id, { index: newIndex });
    }
    setOpenMenuId(null);
  };

  const handleEditTags = (card: KnowledgeCard) => {
    const currentTags = (card.tags || []).join(', ');
    const newTagsStr = window.prompt(language === 'zh' ? "编辑标签 (逗号分隔)" : "Edit Tags (Comma separated)", currentTags);
    if (newTagsStr !== null && onUpdateCard) {
      const newTags = newTagsStr.split(/[,，]/).map(t => t.trim()).filter(t => t !== "");
      onUpdateCard(card.id, { tags: newTags });
    }
    setOpenMenuId(null);
  };

  const handleDelete = (cardId: string) => {
    // App.tsx handles confirmation
    if (onDeleteCard) {
      onDeleteCard(cardId);
    }
    setOpenMenuId(null);
  };

  if (cards.length === 0) {
    return (
      <div className="text-center py-20 text-stone-400">
        <div className="mb-4 flex justify-center">
          <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center">
            {isFiltered ? (
              <Search className="w-8 h-8 opacity-20" />
            ) : (
              <BookOpen className="w-8 h-8 opacity-20" />
            )}
          </div>
        </div>
        <p className="text-lg font-medium text-stone-500">
          {isFiltered ? t('card.noMatches') || "No matching cards found" : t('card.noCards')}
        </p>
        {!isFiltered && <p className="text-sm mt-2">{t('card.startPrompt')}</p>}
      </div>
    );
  }

  return (
    <>
      {/* Menu Backdrop */}
      {(openMenuId || openCategoryMenuId) && (
        <div className="fixed inset-0 z-30" onClick={closeAllMenus} />
      )}

      <div className="columns-1 md:columns-2 lg:columns-3 gap-6 space-y-6 pb-20">
        {cards.map((card, index) => {
          const isActionExpanded = expandedActionCards.has(card.id);
          const visibleActionItems = isActionExpanded
            ? card.actionItems
            : card.actionItems?.slice(0, 3);
          const remainingActions = (card.actionItems?.length || 0) - 3;
          const isMenuOpen = openMenuId === card.id;
          const isCategoryMenuOpen = openCategoryMenuId === card.id;

          return (
            <motion.div
              key={card.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: Math.min(index, 10) * 0.03 }}
              className={cn(
                "break-inside-avoid relative",
                (isMenuOpen || isCategoryMenuOpen) ? "z-50" : "z-0"
              )}
            >
              <div
                className={cn(
                  "bg-white rounded-xl border border-stone-200 shadow-sm hover:shadow-md transition-all duration-300 group flex flex-col h-full relative cursor-pointer",
                  (isMenuOpen || isCategoryMenuOpen) ? "overflow-visible" : "overflow-hidden"
                )}
                onClick={() => onOpenDetail(card)}
              >
                {/* Merged Badge */}
                {card.mergedCount && card.mergedCount > 1 && (
                  <div className="absolute top-0 right-0 bg-purple-100 text-purple-700 text-xs font-bold px-3 py-1 rounded-bl-xl flex items-center gap-1 z-10">
                    <Layers className="w-3 h-3" />
                    Merged {card.mergedCount}
                  </div>
                )}

                {/* Thumbnail (Small, top right if exists) */}
                {card.images && card.images.length > 0 && (
                  <div className="h-32 w-full overflow-hidden bg-stone-100 relative">
                    <img
                      src={card.images[0]}
                      alt="Thumbnail"
                      className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  </div>
                )}

                <div className="p-5 flex-1 relative">
                  <div className="flex items-start justify-between mb-2">
                    {/* Category Badge / Button */}
                    <div className="relative">
                      <button
                        onClick={(e) => handleCategoryClick(card.id, e)}
                        className="inline-block px-2 py-1 rounded-md bg-stone-100 text-stone-500 text-xs font-medium uppercase tracking-wide hover:bg-stone-200 hover:text-stone-700 transition-colors"
                      >
                        {card.category}
                      </button>

                      {/* Category Dropdown */}
                      <AnimatePresence>
                        {isCategoryMenuOpen && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 5 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 5 }}
                            className="absolute left-0 top-full mt-1 w-48 bg-white rounded-lg shadow-xl border border-stone-100 z-40 overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="px-3 py-2 text-xs font-semibold text-stone-400 uppercase border-b border-stone-50">
                              {language === 'zh' ? '更改分类' : 'Change Category'}
                            </div>
                            <div className="max-h-48 overflow-y-auto py-1">
                              {categories.map(cat => (
                                <button
                                  key={cat}
                                  onClick={() => {
                                    if (onMoveCard) onMoveCard(card.id, cat);
                                    setOpenCategoryMenuId(null);
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
                        )}
                      </AnimatePresence>
                    </div>

                    <div className="flex items-center gap-1">
                      {/* Star Button */}
                      {onToggleStar && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleStar(card.id);
                          }}
                          className={cn(
                            "p-1.5 rounded-full transition-colors",
                            card.isStarred ? "text-yellow-400 hover:bg-yellow-50" : "text-stone-300 hover:text-yellow-400 hover:bg-stone-100"
                          )}
                        >
                          <Star className={cn("w-4 h-4", card.isStarred && "fill-current")} />
                        </button>
                      )}

                      {/* Context Menu Button */}
                      <div className="relative">
                        <button
                          onClick={(e) => handleMenuClick(card.id, e)}
                          className="p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-full transition-colors"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>

                        {/* Context Dropdown Menu */}
                        <AnimatePresence>
                          {isMenuOpen && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95, y: 5 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: 5 }}
                              className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-xl border border-stone-100 z-40 overflow-hidden"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="py-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRename(card);
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 flex items-center gap-2"
                                >
                                  <Edit2 className="w-3 h-3" />
                                  {language === 'zh' ? '重命名标题' : 'Rename Title'}
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditSummary(card);
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 flex items-center gap-2"
                                >
                                  <FileText className="w-3 h-3" />
                                  {language === 'zh' ? '编辑摘要' : 'Edit Summary'}
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditTags(card);
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 flex items-center gap-2"
                                >
                                  <Tag className="w-3 h-3" />
                                  {language === 'zh' ? '管理标签' : 'Edit Tags'}
                                </button>
                                {card.mergedCount && card.mergedCount > 1 && onUnmerge && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onUnmerge(card);
                                      setOpenMenuId(null);
                                    }}
                                    className="w-full text-left px-4 py-2 text-sm text-purple-600 hover:bg-purple-50 flex items-center gap-2"
                                  >
                                    <Layers className="w-3 h-3" />
                                    {language === 'zh' ? '解散合集' : 'Dissolve Collection'}
                                  </button>
                                )}
                                <div className="border-t border-stone-100 my-1"></div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(card.id);
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  {language === 'zh' ? '删除卡片' : 'Delete Card'}
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>

                  <h3 className={cn(
                    "font-bold text-stone-900 mb-3 leading-tight group-hover:text-indigo-600 transition-colors",
                    card.images && card.images.length > 0 ? "text-lg" : "text-xl"
                  )}>
                    {card.title}
                  </h3>

                  {/* Index List (Short Summary) */}
                  <div className="space-y-2 mb-5">
                    {(card.index || card.details || []).slice(0, 4).map((item, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-stone-600">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-stone-300 flex-shrink-0" />
                        <span className="leading-relaxed line-clamp-2">{item}</span>
                      </div>
                    ))}
                  </div>

                  {/* Mini Action Plan */}
                  {card.actionItems && card.actionItems.length > 0 && (
                    <div className="pt-4 border-t border-stone-100">
                      <div className="flex items-center justify-between gap-2 text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">
                        <div className="flex items-center gap-2">
                          <CheckSquare className="w-3 h-3" />
                          <span>Action Plan ({card.actionItems.filter(i => i.completed).length}/{card.actionItems.length})</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        {visibleActionItems?.map((item, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-2 text-xs text-stone-500"
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleActionItem(card.id, i);
                            }}
                          >
                            <div className={cn(
                              "transition-colors cursor-pointer",
                              item.completed ? "text-indigo-500" : "text-stone-300 hover:text-indigo-400"
                            )}>
                              {item.completed ? <CheckSquare className="w-3 h-3" /> : <Square className="w-3 h-3" />}
                            </div>
                            <span className={cn(
                              "truncate",
                              item.completed && "line-through opacity-50"
                            )}>
                              {item.text}
                            </span>
                          </div>
                        ))}

                        {remainingActions > 0 && !isActionExpanded && (
                          <button
                            onClick={(e) => toggleActionExpansion(card.id, e)}
                            className="text-xs text-indigo-500 hover:text-indigo-700 font-medium flex items-center gap-1 mt-1 pl-5"
                          >
                            Show {remainingActions} more <ChevronDown className="w-3 h-3" />
                          </button>
                        )}

                        {isActionExpanded && (card.actionItems.length > 3) && (
                          <button
                            onClick={(e) => toggleActionExpansion(card.id, e)}
                            className="text-xs text-stone-400 hover:text-stone-600 font-medium flex items-center gap-1 mt-1 pl-5"
                          >
                            Show Less <ChevronUp className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="px-5 py-3 bg-stone-50 border-t border-stone-100 flex items-center justify-between">
                  <div className="flex flex-wrap gap-2">
                    {card.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white border border-stone-200 text-[10px] text-stone-500" title={tag}>
                        <Tag className="w-3 h-3" />
                        <span className="max-w-[60px] truncate">{tag}</span>
                      </span>
                    ))}
                  </div>
                  <span className="text-xs font-medium text-indigo-600 flex items-center gap-1 group-hover:translate-x-1 transition-transform whitespace-nowrap ml-2">
                    Read Full <ArrowUpRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </>
  );
}
export const CardList = memo(CardListInner);
