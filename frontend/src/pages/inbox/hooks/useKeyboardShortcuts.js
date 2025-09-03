import { useEffect } from 'react';


export default function useKeyboardShortcuts({ filteredItems, sel, open, setShowEmoji, setLightbox, setShowChatSearch }) {
useEffect(() => {
const onKey = (e) => {
if ((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='f') {
e.preventDefault();
setShowChatSearch(v=>!v);
}
if (e.altKey && e.key==='ArrowDown') {
e.preventDefault();
if(!filteredItems.length) return;
const idx=filteredItems.findIndex(c=>sel&&c.id===sel.id);
const next=filteredItems[(idx+1)%filteredItems.length]; if(next) open(next);
}
if (e.altKey && e.key==='ArrowUp') {
e.preventDefault();
if(!filteredItems.length) return;
const idx=filteredItems.findIndex(c=>sel&&c.id===sel.id);
const prev=filteredItems[(idx-1+filteredItems.length)%filteredItems.length]; if(prev) open(prev);
}
if (e.key==='Escape') { setShowEmoji(false); setLightbox(l=>({...l,open:false})); setShowChatSearch(false); }
};
window.addEventListener('keydown', onKey);
return ()=>window.removeEventListener('keydown', onKey);
}, [filteredItems, sel, open, setShowEmoji, setLightbox, setShowChatSearch]);
}