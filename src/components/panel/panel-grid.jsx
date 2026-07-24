/* One column on a phone, two on a tablet, three on a wide screen. A panel
   marked `wide` takes two of them. Nothing here is draggable or resizable —
   that is a feature, and nobody has asked for it. */
export default function PanelGrid({ children }) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
      {children}
    </div>
  );
}
