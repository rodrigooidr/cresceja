import { useCallback, useEffect, useState } from 'react';
import { loadSnippets, upsertSnippet, deleteSnippet, searchSnippets } from '../../../inbox/snippets';


export default function useSnippets() {
const [snippets, setSnippets] = useState([]);
const [show, setShow] = useState(false);
const [query, setQuery] = useState('');
const [edit, setEdit] = useState(null);


useEffect(() => { setSnippets(loadSnippets()); }, []);


const save = useCallback((snip) => {
const item = upsertSnippet(snip);
setSnippets(arr => arr.map(s => s.id===item.id?item:s).concat(item));
}, []);


const remove = useCallback((id) => {
deleteSnippet(id);
setSnippets(arr => arr.filter(s => s.id!==id));
}, []);


const results = query? searchSnippets(query): snippets;


return { snippets, results, show, setShow, query, setQuery, edit, setEdit, save, remove };
}