import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Sidebar from './Sidebar';
import CreateUser from './CreateUser';

function UserManagement() {
  const [users, setUsers] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user'));

  const fetchUsers = async () => {
    try {
      const res = await axios.get('http://localhost:4000/api/users', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(res.data);
    } catch {
      setUsers([]);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Deseja deletar este usuário?')) {
      await axios.delete(`http://localhost:4000/api/users/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchUsers();
    }
  };

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line
  }, []);

  return (
    <div className="main-container">
      <Sidebar role={user?.role} />
      <div className="content">
        <h3>Gestão de Usuários</h3>
        <button onClick={() => setShowCreate(!showCreate)} style={{ marginBottom: 15 }}>
          {showCreate ? "Fechar Cadastro" : "Adicionar Usuário"}
        </button>
        {showCreate && (
          <CreateUser
            onUserCreated={() => {
              fetchUsers();
              setShowCreate(false);
            }}
            onCancel={() => setShowCreate(false)}
          />
        )}
        <table className="user-table">
          <thead>
            <tr>
              <th>Nome</th><th>Email</th><th>Papel</th><th>Criado em</th><th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>{u.role}</td>
                <td>{new Date(u.created_at).toLocaleString()}</td>
                <td>
                  <button onClick={() => handleDelete(u.id)}>Excluir</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default UserManagement;