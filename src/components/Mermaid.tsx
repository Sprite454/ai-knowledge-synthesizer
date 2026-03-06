import { useEffect, useRef } from "react";
import mermaid from "mermaid";

interface MermaidProps {
  chart: string;
}

export function Mermaid({ chart }: MermaidProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    mermaid.initialize({ 
      startOnLoad: true,
      theme: 'neutral',
      securityLevel: 'loose',
      fontFamily: 'inherit'
    });
    
    if (containerRef.current) {
      mermaid.contentLoaded();
    }
  }, []);

  useEffect(() => {
    if (containerRef.current && chart) {
      containerRef.current.innerHTML = "";
      const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
      
      // Fix: Replace literal \n with actual newlines if they exist
      const processedChart = chart.replace(/\\n/g, '\n');

      try {
        mermaid.render(id, processedChart).then(({ svg }) => {
          if (containerRef.current) {
            containerRef.current.innerHTML = svg;
          }
        }).catch(error => {
          console.error("Mermaid render error:", error);
          if (containerRef.current) {
            containerRef.current.innerHTML = `<div class="p-4 bg-red-50 text-red-500 text-xs rounded border border-red-100 font-mono whitespace-pre-wrap">Failed to render chart: ${error.message}</div>`;
          }
        });
      } catch (error: any) {
        console.error("Mermaid render error:", error);
        if (containerRef.current) {
          containerRef.current.innerHTML = `<div class="p-4 bg-red-50 text-red-500 text-xs rounded border border-red-100 font-mono whitespace-pre-wrap">Failed to render chart: ${error.message}</div>`;
        }
      }
    }
  }, [chart]);

  return <div ref={containerRef} className="mermaid-chart flex justify-center py-4" />;
}
