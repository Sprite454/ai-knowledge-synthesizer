import { Tldraw } from 'tldraw';
import 'tldraw/tldraw.css'; // ⚠️ 必须引入这行，否则必挂！

export function WhiteboardView() {
  return (
    <div className="w-full h-full relative" style={{ height: 'calc(100vh - 60px)' }}>
      {/* Tldraw 必须包裹在一个有具体高度的 div 里 */}
      <Tldraw persistenceKey="my-knowledge-whiteboard" />
    </div>
  );
}
