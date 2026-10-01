# Publicar o Renato

Este projeto é um servidor Node.js 24 com SQLite. Cloudflare Pages estático não executa a API de pedidos. Workers não executa este servidor e seu banco em arquivo sem adaptação para o runtime e D1. Não use `npx serve dist` para atender clientes.

## Cloudflare com este projeto

### Ferramentas locais

O Wrangler está nas dependências de desenvolvimento: `npm ci` instala a versão registrada no projeto. Confira com `npx wrangler --version`. Ele será útil se a API for adaptada para Workers/D1; não publica o servidor Node atual sem essa adaptação.

Para a opção Tunnel no Windows, instale o conector oficial com `winget install --id Cloudflare.cloudflared --exact --source winget` e confira com `cloudflared --version`. O conector é instalado no computador, não pelo npm. Instalar as ferramentas não cria um tunnel nem publica o site; configure o domínio e o servidor seguindo os passos abaixo.

Use um servidor Node permanentemente ligado, armazenamento persistente e Cloudflare Tunnel, ou um provedor Node atrás do domínio Cloudflare. O celular do Renato acessa o domínio HTTPS; ele não precisa executar o servidor no celular.

1. No servidor, instale Node.js 24, clone o repositório e rode `npm ci --omit=dev`.
2. Configure `PUBLIC_ORIGIN=https://seu-dominio.com.br`, `PUSH_SUBJECT=https://seu-dominio.com.br`, `DATA_DIR` apontando para armazenamento privado e persistente e `ADMIN_PASSWORD` no gerenciador de segredos. Não salve credenciais no GitHub. Não coloque barra final em PUBLIC_ORIGIN.
3. No Tunnel que roda no mesmo servidor, configure `TRUST_PROXY_FROM=127.0.0.1,::1` e mantenha o serviço acessível apenas pelo loopback. Isso permite usar o IP de visitante informado pelo Cloudflare. Nunca habilite essa confiança para conexões diretas de visitantes. Se o proxy usa outro IP privado (por exemplo Docker), configure somente o IP exato dele e impeça acesso direto ao serviço. Execute `npm start` por um gerenciador de serviço com reinício automático. Com Tunnel no mesmo computador, mantenha HOST=127.0.0.1.
4. Crie um Cloudflare Tunnel e encaminhe seu domínio para `http://localhost:4173`. Guarde a credencial do tunnel somente no servidor.
5. Não configure cache para `/api/*`, `/painel`, `/js/catalog.js` ou respostas administrativas. Não use uma regra global de cache para HTML ou API.
6. Entre em `/painel`, configure Pix com a chave real, confirme os preços e mantenha a loja fechada até concluir os testes abaixo.

O Dockerfile é uma alternativa para um servidor com Docker. A pasta `/app/data` precisa de um volume persistente com permissão de escrita do usuário node. Configure as variáveis no ambiente do container. Não publique múltiplas réplicas com bancos separados.

## Conferência antes de abrir

- Faça um pedido de teste com adicionais, retirada e entrega, e confira valores e endereço no painel.
- No Pix antecipado, confira o nome e valor no aplicativo Nubank e confirme o recebimento antes de aceitar. A confirmação continua manual; o site não verifica transferências.
- Teste Pix na hora, dinheiro e maquininha; só entregue após receber.
- No celular do Renato, ative os avisos e use Testar aviso. Confira também com a tela bloqueada. No iPhone, instale o painel na tela inicial.
- Reinicie o servidor e confirme que cardápio, fotos e pedidos continuam salvos.
- Faça backup privado da pasta data com o servidor parado. Ela inclui pedidos, fotos, acesso e assinaturas push. Teste a restauração em ambiente separado.

O ambiente e o dispositivo podem atrasar notificações. Não dependa exclusivamente de push para perceber pedidos.

Documentação oficial: [Cloudflare Tunnel](https://developers.cloudflare.com/tunnel/get-started/) e [compatibilidade Node em Workers](https://developers.cloudflare.com/workers/runtime-apis/nodejs/).
