import React, { useEffect, useState } from 'react';
import axios from 'axios';
import ClientForm from './ClientForm';

const ClientList = () => {
  const [clients, setClients] = useState([]);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const fetchClients = async () => {
    const token = localStorage.getItem('token');
    const response = await axios.get('http://localhost:4000/api/clients', {
      headers: { Authorization: `Bearer ${token}` }
    });
    setClients(response.data);
    setEditing(null);
    setShowForm(false);
  };

  const deleteClient = async (id) => {
    const token = localStorage.getItem('token');
    await axios.delete(`http://localhost:4000/api/clients/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    fetchClients();
  };

  useEffect(() => {
    fetchClients();
  }, []);

  // Recupera o papel do usuário para passar ao Sidebar
  const user = JSON.parse(localStorage.getItem('user'));
  const role = user?.role || 'User';

  return (
    <>
      <h2>Clientes</h2>
      <button onClick={() => setShowForm(true)}>Novo Cliente</button>
      {showForm && (
        <ClientForm
          selected={editing}
          onSuccess={fetchClients}
          onCancel={() => setShowForm(false)}
        />
      )}
      <ul>
        {clients.map(client => (
          <li key={client.id}>
            {client.name} - {client.email} - {client.phone}
            <button onClick={() => { setEditing(client); setShowForm(true); }}>Editar</button>
            <button onClick={() => deleteClient(client.id)}>Excluir</button>
          </li>
        ))}
      </ul>
    </>
  );
};

export default ClientList;