const { User } = require('./models');
const bcrypt = require('bcryptjs');

(async () => {
  try {
    // Verificar se já existe um usuário teste
    let testUser = await User.findOne({ where: { username: 'teste' } });
    
    if (!testUser) {
      // Criar hash da senha '123456'
      const hashedPassword = await bcrypt.hash('123456', 10);
      
      testUser = await User.create({
        username: 'teste',
        email: 'teste@teste.com',
        password: hashedPassword,
        role: 'admin'
      });
      
      console.log('Usuário teste criado:', {
        id: testUser.id,
        username: testUser.username,
        email: testUser.email,
        role: testUser.role
      });
    } else {
      console.log('Usuário teste já existe:', {
        id: testUser.id,
        username: testUser.username,
        email: testUser.email,
        role: testUser.role
      });
    }
    
    // Testar se a senha funciona
    const isMatch = await bcrypt.compare('123456', testUser.password);
    console.log('Senha 123456 confere:', isMatch);
    
  } catch (error) {
    console.error('Erro:', error.message);
  }
  process.exit(0);
})();