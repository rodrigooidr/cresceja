const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(helmet());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'API CresceJá funcionando!' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});