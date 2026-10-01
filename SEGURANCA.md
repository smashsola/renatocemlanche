# Proteção implementada — 1.14

O painel usa uma conta de responsável (usuário renato por padrão, configurável com ADMIN_USER). O acesso pelo endereço /painel pode ser salvo como atalho no celular. Não há link de administração no nav ou footer do cliente. A proteção efetiva é a autorização da API, não o desconhecimento do endereço.

## Limites de acesso

- Cliente: catálogo, funcionamento, taxa e consulta de seu pedido usando identificador aleatório de 192 bits. Não há lista pública de pedidos nem consulta pelo número sequencial. A API do cliente devolve primeiro nome, itens/adicionais, valor e status; não devolve telefone, endereço ou observações completos.
- Renato: usuário e senha, sessão de 12 horas em cookie HttpOnly e SameSite Strict. Cookie Secure quando PUBLIC_ORIGIN é HTTPS. Após reiniciar o servidor, precisa entrar novamente. A API administrativa mantém endereço, telefone, observações e fila fora do acesso anônimo.
- Dados: SQLite e arquivo de senha inicial ficam fora de dist, sem rota pública. Nenhum deles entra no ZIP.

## Controles verificados

Cálculos e disponibilidade no servidor; consultas SQL parametrizadas; texto do cliente escapado na interface; limite de tentativas de login; limite de envio e consulta; proteção de origem nos POST/PATCH; limite de corpo e tempo da requisição; prevenção de duplicação por identificador; conflito de versão nas alterações; CSP com scripts e conexões do próprio site, anti-iframe e recursos do aparelho desabilitados. O scrypt verifica a senha. A senha inicial aleatória é entregue em arquivo privado para uso local; mantenha esse arquivo protegido e configure a senha por ambiente seguro na hospedagem.

As verificações automatizadas cobrem login/rotas administrativas sem sessão, origem estrangeira, tentativa de acessar SQLite por URL, respostas do acompanhamento sem contato/endereço, adicionais/total, repetição do envio e persistência. A verificação no navegador confirmou funcionamento com CSP, recuperação por Meus pedidos e renderização dos adicionais. Isso é uma revisão focal, não uma certificação nem garantia de ausência de falhas.

## Acompanhamento sem conta

localStorage guarda apenas identificadores e metadados dos pedidos. Durante uma tentativa sem confirmação, os dados do envio também são mantidos para repetir o mesmo pedido; são removidos após confirmação ou rejeição definitiva. Recolher só esconde a interface. O pedido permanece no servidor e pode ser recuperado pelo link privado. Limpar o armazenamento local apaga o acesso naquele navegador, não o pedido no banco. O fragmento do link não é enviado ao servidor na navegação; a consulta usa POST com o identificador no corpo. Quem receber esse link terá acesso ao acompanhamento limitado; não o divulgue publicamente.

## Antes de operar publicamente

Hospedar com HTTPS real, diretório persistente privado, backups e restauração verificados. Configurar PUBLIC_ORIGIN e senha forte por ambiente seguro. Revisar os limites de tráfego com o proxy da hospedagem, sem confiar cegamente em cabeçalhos de IP enviados por clientes. MFA do responsável ainda não foi implementado. Definir com Renato o prazo de guarda dos contatos/endereço e acesso aos backups. Não há gateway ou credencial financeira no navegador; confirmação de Pix continua manual no banco.

## Inspeção pelo navegador — 1.16

Os arquivos públicos não contêm senha administrativa ou credenciais financeiras. Os comentários foram removidos e não são publicados mapas de código-fonte. O servidor só entrega os formatos do site; arquivos ocultos, textos internos, JSON, banco e fontes do servidor não são entregues. DATA_DIR não pode ficar dentro de dist.

F12 permite ver e alterar a interface, ler o próprio rascunho e acompanhamento e fazer chamadas à API. Essas mudanças não concedem sessão administrativa nem alteram o catálogo/preços calculados no servidor. O acompanhamento é um acesso por link privado: quem tiver o identificador pode consultar aquela projeção limitada. Senhas digitadas pelo próprio administrador aparecem na requisição de login em seu navegador; em produção o transporte precisa usar HTTPS.
