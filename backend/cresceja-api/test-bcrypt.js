const bcrypt = require('bcrypt');

const senhaDigitada = 'admin123';
const senhaDoBanco = '$2b$10$9lUqlFke6PT7Ftj7/7jYfuEf1wRxr32b4Y7CFsMQchdMTF06iROXO'; // altere aqui pelo valor real

bcrypt.compare(senhaDigitada, senhaDoBanco, (err, result) => {
  if (result) {
    console.log('✅ A senha está correta!');
  } else {
    console.log('❌ Senha inválida');
  }
});