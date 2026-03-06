import { useEffect, useState, useRef } from "react";
import mermaid from "mermaid";
import { KnowledgeCard } from "@/types";
import { useLanguage } from "@/contexts/LanguageContext";

interface KnowledgeGraphProps {
  cards: KnowledgeCard[];
  onNodeClick: (card: KnowledgeCard) => void;
}

export function KnowledgeGraph({ cards, onNodeClick }: KnowledgeGraphProps) {
  const { language } = useLanguage();
  const [graphDefinition, setGraphDefinition] = useState("");
  const graphRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Generate Mermaid graph definition from cards
    let def = "graph TD;\n";
    
    // Add nodes
    cards.forEach(card => {
      // Sanitize ID and Title for Mermaid
      // Mermaid IDs must be alphanumeric + underscore
      const safeId = `node_${card.id.replace(/-/g, '_')}`;
      const safeTitle = card.title.replace(/["\n]/g, '').replace(/[()]/g, '');
      
      // Styling based on category
      let styleClass = "default";
      if (card.category === "Programming") styleClass = "programming";
      if (card.category === "Social Media") styleClass = "social";
      
      def += `  ${safeId}["${safeTitle}"]:::${styleClass};\n`;
      
      // Add click interaction
      def += `  click ${safeId} call onGraphNodeClick("${card.id}")\n`;
    });

    // Add links based on [[Title]] references in fullMarkdown
    cards.forEach(sourceCard => {
      const sourceId = `node_${sourceCard.id.replace(/-/g, '_')}`;
      
      if (sourceCard.fullMarkdown) {
        // Find all [[Title]] occurrences
        const regex = /\[\[(.*?)\]\]/g;
        let match;
        while ((match = regex.exec(sourceCard.fullMarkdown)) !== null) {
          const targetTitle = match[1];
          const targetCard = cards.find(c => c.title.toLowerCase() === targetTitle.toLowerCase());
          
          if (targetCard && targetCard.id !== sourceCard.id) {
            const targetId = `node_${targetCard.id.replace(/-/g, '_')}`;
            def += `  ${sourceId} --> ${targetId};\n`;
          }
        }
      }
    });

    // Add styling classes
    def += `
      classDef default fill:#fff,stroke:#e5e7eb,stroke-width:1px,color:#374151;
      classDef programming fill:#eff6ff,stroke:#bfdbfe,stroke-width:1px,color:#1e40af;
      classDef social fill:#fdf2f8,stroke:#fbcfe8,stroke-width:1px,color:#be185d;
    `;

    setGraphDefinition(def);
  }, [cards]);

  useEffect(() => {
    // Expose the click handler to the window object so Mermaid can call it
    (window as any).onGraphNodeClick = (cardId: string) => {
      const card = cards.find(c => c.id === cardId);
      if (card) {
        onNodeClick(card);
      }
    };

    mermaid.initialize({ 
      startOnLoad: false, // We handle loading manually
      theme: 'neutral',
      securityLevel: 'loose',
      fontFamily: 'Inter, sans-serif',
      flowchart: {
        useMaxWidth: false,
        htmlLabels: true,
        curve: 'basis'
      }
    });
    
  }, [cards, onNodeClick]);

  useEffect(() => {
    const renderGraph = async () => {
      if (graphDefinition && graphRef.current) {
        try {
          // Clear previous content
          graphRef.current.removeAttribute("data-processed");
          graphRef.current.innerHTML = graphDefinition;
          
          await mermaid.run({
            nodes: [graphRef.current]
          });
        } catch (error) {
          console.error("Mermaid run error:", error);
          if (graphRef.current) {
             graphRef.current.innerHTML = `<div class="text-red-400 text-xs p-4">Failed to render graph: ${(error as any).message}</div>`;
          }
        }
      }
    };

    renderGraph();
  }, [graphDefinition]);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-stone-50/50 rounded-xl border border-stone-200 overflow-hidden relative">
      <div className="absolute top-4 left-4 z-10 bg-white/80 backdrop-blur px-3 py-1 rounded-full text-xs font-medium text-stone-500 border border-stone-100 shadow-sm">
        {language === 'zh' ? '🌌 知识星图 (点击节点查看)' : '🌌 Knowledge Graph (Click nodes to view)'}
      </div>
      <div className="w-full h-full overflow-auto p-8 flex items-center justify-center">
        <div ref={graphRef} className="mermaid">
          {/* Content will be injected by mermaid.run */}
        </div>
      </div>
    </div>
  );
}
