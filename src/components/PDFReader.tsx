import { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { getFile } from '@/services/storage';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Loader2 } from 'lucide-react';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface PDFReaderProps {
  fileId: string;
  initialPage?: number;
}

export interface PDFReaderRef {
  jumpToPage: (page: number) => void;
}

export const PDFReader = forwardRef<PDFReaderRef, PDFReaderProps>(({ fileId, initialPage = 1 }, ref) => {
  const [file, setFile] = useState<File | null>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(initialPage);
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadFile = async () => {
      try {
        const blob = await getFile(fileId);
        if (blob) {
          setFile(blob);
        }
      } catch (error) {
        console.error("Failed to load PDF file:", error);
      } finally {
        setLoading(false);
      }
    };
    loadFile();
  }, [fileId]);

  useImperativeHandle(ref, () => ({
    jumpToPage: (page: number) => {
      if (page >= 1 && page <= (numPages || 1)) {
        setPageNumber(page);
      }
    }
  }));

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
  }

  if (loading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin" /></div>;
  }

  if (!file) {
    return <div className="flex items-center justify-center h-full text-stone-500">PDF file not found</div>;
  }

  return (
    <div className="flex flex-col h-full bg-stone-100">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-2 bg-white border-b border-stone-200 shadow-sm z-10">
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setPageNumber(prev => Math.max(prev - 1, 1))}
            disabled={pageNumber <= 1}
            className="p-1 hover:bg-stone-100 rounded disabled:opacity-50"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm font-medium">
            Page {pageNumber} of {numPages || '--'}
          </span>
          <button 
            onClick={() => setPageNumber(prev => Math.min(prev + 1, numPages || 1))}
            disabled={pageNumber >= (numPages || 1)}
            className="p-1 hover:bg-stone-100 rounded disabled:opacity-50"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setScale(prev => Math.max(prev - 0.1, 0.5))}
            className="p-1 hover:bg-stone-100 rounded"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs w-12 text-center">{Math.round(scale * 100)}%</span>
          <button 
            onClick={() => setScale(prev => Math.min(prev + 0.1, 2.0))}
            className="p-1 hover:bg-stone-100 rounded"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* PDF Content */}
      <div className="flex-1 overflow-auto p-4 flex justify-center">
        <Document
          file={file}
          onLoadSuccess={onDocumentLoadSuccess}
          className="shadow-lg"
          loading={<Loader2 className="animate-spin" />}
        >
          <Page 
            pageNumber={pageNumber} 
            scale={scale} 
            renderTextLayer={true}
            renderAnnotationLayer={true}
            className="bg-white"
          />
        </Document>
      </div>
    </div>
  );
});

PDFReader.displayName = 'PDFReader';
