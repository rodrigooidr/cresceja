import React, { useState } from 'react';
import axios from 'axios';

function Profile() {
  const user = JSON.parse(localStorage.getItem('user'));
  const token = localStorage.getItem('token');
  const [newPassword, setNewPassword] = useState('');
  const [msg, setMsg] = useState('');

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    try {
      await axios.put('http://localhost:4000/api/users/password', { password: newPassword }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMsg('Senha alterada com sucesso!');
      setNewPassword('');
    } catch {
      setMsg('Erro ao alterar senha.');
    }
  };

  return (
    <div>
      <h3>Meu Perfil</h3>
      <p><b>Nome:</b> {user?.name}</p>
      <p><b>Email:</b> {user?.email}</p>
      <p><b>Papel:</b> {user?.role}</p>
      <hr/>
      <form onSubmit={handlePasswordChange}>
        <label>Nova senha:</label><br/>
        <input
          type="password"
          value={newPassword}
          onChange={e => setNewPassword(e.target.value)}
          required
        /><br/>
        <button type="submit">Alterar Senha</button>
      </form>
      {msg && <p>{msg}</p>}
    </div>
  );
}

export default Profile;