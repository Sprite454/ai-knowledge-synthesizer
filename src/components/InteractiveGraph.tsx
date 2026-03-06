import React, { useRef, useMemo, useState, useCallback, useEffect } from 'react';
import ForceGraph2D, { ForceGraphMethods } from 'react-force-graph-2d';
import { KnowledgeCard } from '@/types';
import { useLanguage } from '@/contexts/LanguageContext';
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react';

interface InteractiveGraphProps {
  cards: KnowledgeCard[];
  onNodeClick: (card: KnowledgeCard) => void;
}

// Color palette for categories
const CATEGORY_COLORS: Record<string, string> = {
  '📚 知识库': '#4F46E5', // Indigo
  '💼 工作': '#059669',   // Emerald
  '🚀 个人成长': '#D97706', // Amber
  '🎨 生活': '#DB2777',   // Pink
  '📥 未分类': '#6B7280', // Gray
  'default': '#6366F1'    // Fallback
};

const getCategoryColor = (category: string) => {
  return CATEGORY_COLORS[category] || CATEGORY_COLORS['default'];
};

export function InteractiveGraph({ cards, onNodeClick }: InteractiveGraphProps) {
  const fgRef = useRef<ForceGraphMethods | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const { language } = useLanguage();
  const [highlightNodes, setHighlightNodes] = useState(new Set<string>());
  const [highlightLinks, setHighlightLinks] = useState(new Set<object>());
  const [hoverNode, setHoverNode] = useState<any | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  
  // Double click detection
  const lastClick = useRef(0);

  // Resize observer
  useEffect(() => {
    if (!containerRef.current) return;
    
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };

    const resizeObserver = new ResizeObserver(updateDimensions);
    resizeObserver.observe(containerRef.current);
    updateDimensions();

    return () => resizeObserver.disconnect();
  }, []);

  // Transform Data
  const graphData = useMemo(() => {
    const nodes: any[] = [];
    const links: any[] = [];
    const titleToIdMap = new Map<string, string>();
    const urlToIdMap = new Map<string, string>();

    // 1. Create Nodes and Map Titles/URLs
    cards.forEach(card => {
      titleToIdMap.set(card.title.toLowerCase(), card.id);
      if (card.sourceUrl) {
        urlToIdMap.set(card.sourceUrl, card.id);
      }
      
      nodes.push({
        id: card.id,
        name: card.title,
        category: card.category,
        val: 1, // Default size, will update based on backlinks
        color: getCategoryColor(card.category),
        desc: card.coreConcept || card.fullMarkdown?.slice(0, 100) || "No description",
        tags: card.tags || [],
        cardData: card // Store full card for click handler
      });
    });

    // 2. Calculate Links (Strict Mode)
    const backlinkCounts = new Map<string, number>();

    // Helper to add link
    const addLink = (source: string, target: string, type: 'strong' | 'weak') => {
      // Prevent self-loops
      if (source === target) return;

      const linkId = [source, target].sort().join('-');
      // Check if link already exists
      if (links.some(l => {
        const existingId = [l.source, l.target].sort().join('-');
        return existingId === linkId;
      })) return;

      links.push({
        source,
        target,
        type,
        color: type === 'strong' ? '#9CA3AF' : '#E5E7EB', // Strong: Gray-400, Weak: Gray-200
        width: type === 'strong' ? 2 : 1,
        dash: type === 'weak' ? [4, 2] : undefined
      });

      // Update backlink counts for target (referenced node)
      backlinkCounts.set(target, (backlinkCounts.get(target) || 0) + 1);
    };

    // Rule A: Strong Links (Explicit Reference)
    cards.forEach(sourceCard => {
      // 1. Check [[Title]] references
      if (sourceCard.fullMarkdown) {
        const regex = /\[\[(.*?)\]\]/g;
        let match;
        while ((match = regex.exec(sourceCard.fullMarkdown)) !== null) {
          const targetTitle = match[1].toLowerCase();
          const targetId = titleToIdMap.get(targetTitle);
          
          if (targetId) {
            addLink(sourceCard.id, targetId, 'strong');
          }
        }
      }

      // 2. Check Shared Source URL
      if (sourceCard.sourceUrl) {
        // Find other cards with same source URL (if any logic requires this, 
        // but usually sourceUrl is unique per card unless split. 
        // If multiple cards share sourceUrl, they are strongly related.)
        cards.forEach(targetCard => {
            if (sourceCard.id !== targetCard.id && 
                sourceCard.sourceUrl && 
                targetCard.sourceUrl === sourceCard.sourceUrl) {
                addLink(sourceCard.id, targetCard.id, 'strong');
            }
        });
      }
    });

    // Rule B: Weak Links (>= 2 Shared Tags)
    // O(N^2) - acceptable for < 1000 nodes usually
    for (let i = 0; i < cards.length; i++) {
      for (let j = i + 1; j < cards.length; j++) {
        const cardA = cards[i];
        const cardB = cards[j];
        
        // Skip if already linked strongly (optimization)
        // (Logic handled by addLink check, but good to skip heavy calc)
        
        if (!cardA.tags || !cardB.tags) continue;

        const sharedTags = cardA.tags.filter(tag => cardB.tags?.includes(tag));
        if (sharedTags.length >= 2) {
          addLink(cardA.id, cardB.id, 'weak');
        }
      }
    }

    // 3. Update Node Sizes based on Backlinks
    nodes.forEach(node => {
      const count = backlinkCounts.get(node.id) || 0;
      // Base size 4, add count.
      node.val = 4 + (count * 2); 
    });

    return { nodes, links };
  }, [cards]);

  // Interaction Handlers
  const handleNodeHover = (node: any | null) => {
    setHoverNode(node);
    
    if (node) {
      const newHighlightNodes = new Set<string>();
      const newHighlightLinks = new Set<object>();
      
      newHighlightNodes.add(node.id);
      
      // Find neighbors
      graphData.links.forEach(link => {
        const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
        const targetId = typeof link.target === 'object' ? link.target.id : link.target;
        
        if (sourceId === node.id) {
          newHighlightNodes.add(targetId);
          newHighlightLinks.add(link);
        } else if (targetId === node.id) {
          newHighlightNodes.add(sourceId);
          newHighlightLinks.add(link);
        }
      });
      
      setHighlightNodes(newHighlightNodes);
      setHighlightLinks(newHighlightLinks);
    } else {
      setHighlightNodes(new Set());
      setHighlightLinks(new Set());
    }
  };

  const handleNodeClick = useCallback((node: any) => {
    if (!fgRef.current) return;
    
    const now = Date.now();
    if (now - lastClick.current < 300) {
      // Double click: Open details
      if (node.cardData) {
        onNodeClick(node.cardData);
      }
    } else {
      // Single click: Fly to node
      fgRef.current.centerAt(node.x, node.y, 1000);
      fgRef.current.zoom(6, 2000);
    }
    lastClick.current = now;
  }, [onNodeClick]);

  // Custom Node Rendering
  const paintNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const label = node.name;
    const fontSize = 12 / globalScale;
    const r = Math.sqrt(node.val) * 4; // Radius calculation matching force-graph default logic approx

    // 1. Draw Node Circle
    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI, false);
    
    // Highlight logic
    const isHighlighted = highlightNodes.size > 0 && highlightNodes.has(node.id);
    const isDimmed = highlightNodes.size > 0 && !highlightNodes.has(node.id);
    
    ctx.fillStyle = isDimmed ? '#4B5563' : node.color;
    ctx.fill();
    
    // Ring for highlighted
    if (isHighlighted || node === hoverNode) {
      ctx.strokeStyle = '#FCD34D'; // Amber ring
      ctx.lineWidth = 2 / globalScale;
      ctx.stroke();
    }

    // 2. Draw Label (only if zoomed in enough or hovered)
    // Show label if globalScale > 1.5 OR if node is hovered/highlighted
    if (globalScale > 1.5 || isHighlighted || node === hoverNode) {
      ctx.font = `${fontSize}px Sans-Serif`;
      const textWidth = ctx.measureText(label).width;
      const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.2); // padding

      // Label Background (semi-transparent black)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(
        node.x - bckgDimensions[0] / 2, 
        node.y + r + 2, // Position below the node
        bckgDimensions[0], 
        bckgDimensions[1]
      );

      // Label Text
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'white';
      ctx.fillText(
        label, 
        node.x, 
        node.y + r + 2 + bckgDimensions[1] / 2
      );
    }
  }, [highlightNodes, hoverNode]);

  // Controls
  const handleZoomIn = () => {
    if (fgRef.current) {
      fgRef.current.zoom(fgRef.current.zoom() * 1.5, 500);
    }
  };

  const handleZoomOut = () => {
    if (fgRef.current) {
      fgRef.current.zoom(fgRef.current.zoom() / 1.5, 500);
    }
  };

  const handleFitView = () => {
    if (fgRef.current) {
      fgRef.current.zoomToFit(500, 50);
    }
  };

  return (
    <div className="relative w-full h-full bg-stone-900 overflow-hidden" ref={containerRef}>
      <ForceGraph2D
        ref={fgRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={graphData}
        nodeLabel="name"
        nodeCanvasObject={paintNode}
        nodeColor={(node: any) => 
          highlightNodes.size > 0 && !highlightNodes.has(node.id) 
            ? '#4B5563' // Dimmed (Gray-600)
            : node.color
        }
        linkColor={(link: any) => 
          highlightLinks.has(link) ? '#FCD34D' : link.color // Highlight: Amber-300
        }
        linkWidth={(link: any) => 
          highlightLinks.has(link) ? 3 : link.width
        }
        linkLineDash={(link: any) => link.dash}
        cooldownTicks={100}
        onNodeHover={handleNodeHover}
        onNodeClick={handleNodeClick}
        onNodeDragEnd={node => {
          // Optional: fix node position after drag
          node.fx = node.x;
          node.fy = node.y;
        }}
        onBackgroundClick={() => {
          setHighlightNodes(new Set());
          setHighlightLinks(new Set());
        }}
      />

      {/* Tooltip for Hover - Simplified since we have labels now, but keeping for details */}
      {hoverNode && (
        <div 
          className="absolute pointer-events-none bg-black/80 backdrop-blur-md text-white p-3 rounded-lg shadow-xl border border-white/10 z-10 max-w-xs"
          style={{ 
            top: 20, 
            right: 20 
          }}
        >
          <h3 className="font-bold text-lg mb-1">{hoverNode.name}</h3>
          <div className="text-xs text-gray-300 mb-2 line-clamp-3">{hoverNode.desc}</div>
          <div className="flex flex-wrap gap-1">
            {hoverNode.tags.slice(0, 3).map((tag: string) => (
              <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-white/20 rounded-full">
                #{tag}
              </span>
            ))}
          </div>
          <div className="mt-2 text-[10px] text-gray-400 italic">
            {language === 'zh' ? '双击查看详情' : 'Double-click to view details'}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="absolute bottom-6 right-6 flex flex-col gap-2">
        <button 
          onClick={handleZoomIn}
          className="p-2 bg-stone-800 text-white rounded-full shadow-lg hover:bg-stone-700 transition-colors border border-stone-700"
          title={language === 'zh' ? '放大' : 'Zoom In'}
        >
          <ZoomIn className="w-5 h-5" />
        </button>
        <button 
          onClick={handleZoomOut}
          className="p-2 bg-stone-800 text-white rounded-full shadow-lg hover:bg-stone-700 transition-colors border border-stone-700"
          title={language === 'zh' ? '缩小' : 'Zoom Out'}
        >
          <ZoomOut className="w-5 h-5" />
        </button>
        <button 
          onClick={handleFitView}
          className="p-2 bg-stone-800 text-white rounded-full shadow-lg hover:bg-stone-700 transition-colors border border-stone-700"
          title={language === 'zh' ? '适配屏幕' : 'Fit View'}
        >
          <Maximize className="w-5 h-5" />
        </button>
      </div>
      
      {/* Legend */}
      <div className="absolute bottom-6 left-6 bg-black/50 backdrop-blur-sm p-3 rounded-lg border border-white/10">
        <div className="text-xs font-bold text-white mb-2">{language === 'zh' ? '图例' : 'Legend'}</div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-gray-400"></div>
            <span className="text-[10px] text-gray-300">{language === 'zh' ? '引用关联' : 'Reference'}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 border-t border-dashed border-gray-400"></div>
            <span className="text-[10px] text-gray-300">{language === 'zh' ? '标签关联 (≥2)' : 'Tag Match (≥2)'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
