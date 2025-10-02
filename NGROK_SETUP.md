# Configuração do Ngrok para AgroApp

## URL Pública Atual
**https://e38caee07fd8.ngrok-free.app**

✅ **Status**: Funcionando corretamente!

## Correções Aplicadas

### 1. Configuração de Sessão
- Ajustado `secure: false` para funcionar com HTTP/HTTPS do ngrok
- Configurado `sameSite: 'lax'` para melhor compatibilidade
- Adicionado `SESSION_SECRET` no arquivo .env

### 2. CORS (Cross-Origin Resource Sharing)
- Configurado para aceitar domínios ngrok (*.ngrok.io e *.ngrok-free.app)
- Habilitado `credentials: true` para cookies de sessão
- Permitidos métodos HTTP necessários

### 3. Content Security Policy (CSP)
- Adicionados domínios ngrok nas diretivas de segurança
- Configurado para permitir scripts, estilos e recursos do ngrok

### 4. Proxy Trust
- Configurado `app.set('trust proxy', 1)` para funcionar com proxies

## Como Usar

### 1. Iniciar o Servidor Local
```bash
node app.js
```

### 2. Iniciar o Ngrok (em outro terminal)
```bash
ngrok http 3001
```

### 3. Obter a URL Pública
```bash
curl -s http://localhost:4040/api/tunnels | python3 -m json.tool
```

### 4. Acessar a Aplicação
- Use a URL fornecida pelo ngrok (ex: https://7c78a95d6a92.ngrok-free.app)
- Acesse diretamente: https://7c78a95d6a92.ngrok-free.app/auth/login

## Problemas Comuns e Soluções

### 1. Erro de CORS
- ✅ **Resolvido**: Configuração CORS atualizada para ngrok

### 2. Problemas de Sessão/Cookies
- ✅ **Resolvido**: Configuração de cookies ajustada para ngrok

### 3. Content Security Policy Bloqueando Recursos
- ✅ **Resolvido**: CSP configurado para permitir domínios ngrok

### 4. Erro "ngrok-skip-browser-warning"
- Adicione o header `ngrok-skip-browser-warning: true` nas requisições
- Ou acesse via navegador e clique em "Visit Site"

## Monitoramento

### Interface Web do Ngrok
- Acesse: http://localhost:4040
- Visualize requisições em tempo real
- Monitore tráfego e erros

### Logs do Servidor
- Monitore o terminal onde o `node app.js` está rodando
- Verifique logs de autenticação e erros

## Notas Importantes

1. **Segurança**: Esta configuração é para desenvolvimento/teste
2. **URL Dinâmica**: A URL do ngrok muda a cada reinicialização
3. **Rate Limiting**: Ngrok gratuito tem limitações de requisições
4. **HTTPS**: O ngrok fornece HTTPS automaticamente

## Testando a Aplicação

1. Acesse: https://7c78a95d6a92.ngrok-free.app/auth/login
2. Faça login com suas credenciais
3. Navegue para: https://7c78a95d6a92.ngrok-free.app/sales/pdv
4. Teste as funcionalidades de venda

## Comandos Úteis

```bash
# Verificar se o servidor está rodando
curl http://localhost:3001

# Verificar túneis do ngrok
curl http://localhost:4040/api/tunnels

# Parar o ngrok
# Pressione Ctrl+C no terminal do ngrok

# Reiniciar com nova URL
ngrok http 3001
```