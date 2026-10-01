# Renato 100% Lanches

Site de pedidos, acompanhamento sem conta e painel do trailer. Cloudflare Workers e D1 em produção, Node.js 24 e SQLite para uso local, React, Tailwind e componentes 21st adaptados ao projeto.

Site publicado: https://renato-100-lanches.betaniaaa.workers.dev · Painel: https://renato-100-lanches.betaniaaa.workers.dev/painel

## Executar

```sh
npm ci
npm start
```

Site: http://127.0.0.1:4173 · Painel: http://127.0.0.1:4173/painel

O usuário padrão é `renato`. No primeiro início, uma senha aleatória é criada em `data/acesso-painel.txt`. Nenhuma senha ou pedido real é distribuído no repositório. A loja começa fechada.

## Atendimento

O painel abre na fila e tem três áreas: **Pedidos**, **Caixa** e **Minha loja**. Produtos, fotos do celular, preços e adicionais podem ser editados; os pedidos antigos preservam seus itens e valores. Os adicionais são cobrados por unidade.

Pix antecipado só pode ser aceito depois da confirmação manual do recebimento no Nubank. Pix na hora, dinheiro e maquininha podem ser aceitos pendentes. Entregar exige pagamento confirmado. Cancelar só é permitido antes do preparo e não estorna transferências.

O cliente não cria conta. Carrinho, adicionais e links de acompanhamento ficam no navegador; pedidos enviados persistem no servidor. Trocar domínio/aparelho ou limpar os dados do navegador exige recuperar pelo link privado. Os links dão acesso aos itens e andamento e devem ser tratados como privados.

## Hospedagem

Leia [HOSPEDAGEM.md](HOSPEDAGEM.md). A versão publicada roda em Workers: pedidos, sessões, cardápio, autenticação, fotos e avisos ficam no D1. Não depende de um computador ligado. **Publicar somente dist em Cloudflare Pages não executa pedidos.** O servidor Node continua disponível para desenvolvimento ou hospedagem própria.

No Worker, configure PUBLIC_ORIGIN com o domínio HTTPS exato e a senha inicial como segredo. Na alternativa Node, configure também DATA_DIR fora de dist e PUSH_SUBJECT com o domínio real. O servidor Node não lê arquivos .env automaticamente. Docker pode carregar as variáveis por sua própria configuração. Nunca publique data, credenciais ou backups.

Push depende do servidor, HTTPS, internet e permissão no celular. Ative o som a cada sessão e teste os avisos no aparelho real; não há garantia de entrega imediata ou som com a tela bloqueada. No iPhone, instale o painel na tela inicial.

## Pix

Cadastre a chave, nome e cidade no painel com sua senha atual. O QR Code usa o valor salvo do pedido e a confirmação é manual. O site não verifica registro da chave, saldo, transferências ou comprovantes. O código é estático, não expira nem pode ser revogado depois de copiado. Confira destinatário e valor no banco antes de abrir a loja.

## Dados e segurança

O servidor recalcula valores e valida adicionais. Administração exige sessão HttpOnly; senhas usam scrypt no servidor Node e PBKDF2-SHA256 com 100 mil iterações no Worker. Sessões do Worker ficam no banco com somente o hash do token. Alterações exigem origem válida e versão atual do registro. Telefone, endereço e observações não aparecem no acompanhamento público. Há limites de requisições, uploads, quantidades e campos, CSP e proteção contra iframe. HTTPS de produção usa cookie Secure e HSTS.

A pasta data também guarda fotos, autenticação e inscrições push. Faça backups privados com o servidor parado e teste restauração. Não substitua nem apague data ao atualizar. Trocar senha encerra as sessões e remove inscrições de avisos. Para recuperação local, execute `npm run recover-access` no servidor; se ADMIN_PASSWORD for definida pelo ambiente, altere nesse ambiente.

Caixa representa recebimentos confirmados menos saídas registradas, não lucro. Taxas de entrega fazem parte das entradas. Pedidos cancelados pagos continuam nas entradas; registre a devolução como saída quando ela acontecer.

## Verificar

```sh
npm run build
npm run check
npm test
npm run test:cloudflare
```

Os testes usam bancos temporários e não alteram o atendimento local. O build compilado está incluído em dist; node_modules não está.

[Guia simples do Renato](GUIA-RENATO.md) · [Créditos e fotos ilustrativas](CREDITOS.md) · [Histórico de mudanças](CHANGELOG.md)

Confirme os preços, ingredientes, porções e entrega com o Renato antes da abertura. Alguns produtos e adicionais foram criados para a apresentação à família.
