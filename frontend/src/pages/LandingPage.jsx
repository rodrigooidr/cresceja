
import React, { useState } from 'react';
import { api } from '../api/axios';

export default function LandingPage(){
  const [form, setForm] = useState({ name:'', email:'', phone:'' });
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    await api.post('/leads', { ...form, source_channel: 'landing', consent: true });
    setSent(true);
  };

  if(sent) return <div><h2>Obrigado!</h2><p>Recebemos seu contato e entraremos em breve.</p></div>;

  return (
    <div style={{maxWidth: 560, margin:'0 auto'}}>
      <h1>CresceJá</h1>
      <p>Teste grátis por 14 dias. Preencha para começar:</p>
      <form onSubmit={submit}>
        <input placeholder="Seu nome" value={form.name} onChange={e=>setForm({...form, name:e.target.value})} required/>
        <input placeholder="E-mail" type="email" value={form.email} onChange={e=>setForm({...form, email:e.target.value})}/>
        <input placeholder="WhatsApp" value={form.phone} onChange={e=>setForm({...form, phone:e.target.value})}/>
        <button type="submit">Quero testar</button>
      </form>
    </div>
  );
}
