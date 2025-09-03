import { useCallback, useEffect, useRef, useState } from 'react';


export default function useChatSearch(msgs, msgRefs) {
const [chatSearch, setChatSearch] = useState('');
const [chatMatches, setChatMatches] = useState([]);
const [chatMatchIdx, setChatMatchIdx] = useState(0);


useEffect(() => {
if (!chatSearch) { setChatMatches([]); setChatMatchIdx(0); return; }
const q = chatSearch.toLowerCase();
const arr = [];
msgs.forEach((m) => {
const tx = (m.text || '').toLowerCase();
let idx = tx.indexOf(q);
while (idx!==-1) { arr.push({ id:m.id }); idx=tx.indexOf(q, idx+q.length); }
});
setChatMatches(arr);
setChatMatchIdx(arr.length?0:0);
}, [chatSearch, msgs]);


useEffect(() => {
if (!chatMatches.length) return;
const target = chatMatches[chatMatchIdx];
const node = msgRefs.current[target.id];
if (node) {
node.scrollIntoView({ block: 'center' });
node.classList.add('outline','outline-2','outline-yellow-400');
setTimeout(()=>node.classList.remove('outline','outline-2','outline-yellow-400'),600);
}
}, [chatMatchIdx, chatMatches, msgRefs]);


const next = useCallback(() => { if(chatMatches.length) setChatMatchIdx(i=>(i+1)%chatMatches.length); }, [chatMatches]);
const prev = useCallback(() => { if(chatMatches.length) setChatMatchIdx(i=>(i-1+chatMatches.length)%chatMatches.length); }, [chatMatches]);


return { chatSearch, setChatSearch, chatMatches, chatMatchIdx, next, prev };
}