import { useCallback, useEffect, useRef, useState } from 'react';
import { loadQuickReplies, saveQuickReply, updateQuickReply, deleteQuickReply, parseVariables, fillDefaultVariables } from '../../../inbox/quickreplies';


export default function useQuickReplies(sel, insertText) {
const [quickReplies, setQuickReplies] = useState([]);
const [showQuick, setShowQuick] = useState(false);
const [qrQuery, setQrQuery] = useState('');
const [qrIdx, setQrIdx] = useState(0);
const [qrVarsOpen, setQrVarsOpen] = useState(false);
const [qrVarValues, setQrVarValues] = useState({});
const qrVarItemRef = useRef(null);


useEffect(() => { loadQuickReplies().then(r => setQuickReplies(Array.isArray(r?.items)?r.items:[])).catch(()=>{}); }, []);


const selectQRItem = useCallback((it) => {
const vars = parseVariables(it.content || '');
if (vars.length) {
qrVarItemRef.current = it;
const defaults = fillDefaultVariables(vars, sel);
setQrVarValues(defaults);
setShowQuick(false); setQrQuery(''); setQrIdx(0); setQrVarsOpen(true);
} else {
insertText(it.content || '');
}
}, [insertText, sel]);


const commitVars = useCallback(() => {
const it = qrVarItemRef.current;
if (!it) return;
let content = it.content || '';
Object.entries(qrVarValues).forEach(([k,v]) => {
const re = new RegExp(`\\{\\{\\s*${k}\\s*\\}}`, 'g');
content = content.replace(re, v);
});
insertText(content);
setQrVarsOpen(false); qrVarItemRef.current = null; setQrVarValues({});
}, [qrVarValues, insertText]);


const handleSave = useCallback(async (form) => {
try {
if (form.id) {
const item = await updateQuickReply(form.id, form);
setQuickReplies(arr => arr.map(i=>String(i.id)===String(item.id)?item:i));
} else {
const item = await saveQuickReply(form);
setQuickReplies(arr => [...arr, item]);
}
} catch {}
}, []);


const handleDelete = useCallback(async (id) => {
try { await deleteQuickReply(id); } catch {}
setQuickReplies(arr => arr.filter(i => String(i.id)!==String(id)));
}, []);


return { quickReplies, showQuick, setShowQuick, qrQuery, setQrQuery, qrIdx, setQrIdx, qrVarsOpen, qrVarValues, setQrVarValues, selectQRItem, commitVars, handleSave, handleDelete };
}