const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 4000;
const dotenv = require('dotenv');
const authRoutes = require('./routes/auth'); 
const users = require('./routes/users');
const clients = require('./routes/clients'); 
const subscriptionRoutes = require('./routes/subscription');
const paymentRoutes = require('./routes/payment');

require('dotenv').config();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/users', users);
app.use('/api/clients', clients);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/payment', paymentRoutes);


app.get('/', (req, res) => {
  res.json({ message: 'API CresceJá funcionando!' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

