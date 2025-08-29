import inboxApi from "../../api/inboxApi";
import React, { useEffect, useState } from 'react';
import { useApi } from '../../contexts/useApi';

export default function ListsPage() {
  const api = useApi();
  const [lists, setLists] = useState([]);
  const [name, setName] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await inboxApi.get('/marketing/lists');
        setLists(res.data.data || []);
      } catch (err) {
        console.error('load lists', err);
      }
    })();
  }, []);

  const create = async () => {
    try {
      const res = await inboxApi.post('/marketing/lists', { name });
      setLists([...lists, res.data.data]);
      setName('');
    } catch (err) {
      console.error('create list', err);
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl mb-4">Listas</h1>
      <div className="mb-4 flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} className="border p-2" placeholder="Nome" />
        <button onClick={create} className="bg-blue-500 text-white px-4 py-2 rounded">Criar</button>
      </div>
      <ul className="list-disc pl-5">
        {lists.map((l) => (
          <li key={l.id}>{l.name}</li>
        ))}
      </ul>
    </div>
  );
}


