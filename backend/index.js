require('dotenv').config();
const app = require('./src/app');
const sequelize = require('./src/config/database');
const PORT = process.env.PORT || 4000;
sequelize.authenticate()
  .then(() => {
    console.log('DB conectado!');
    app.listen(PORT, () => console.log('Servidor na porta', PORT));
  })
  .catch(err => {
    console.error('Erro ao conectar banco:', err);
  });
