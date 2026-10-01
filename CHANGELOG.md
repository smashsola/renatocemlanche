## 1.17.0 — Acesso e caixa do trailer

- Troca de senha com conferência da senha atual, hash persistente e encerramento das sessões.
- Recuperação local por npm run recover-access; sem endpoint público de reset.
- Resumo diário de recebimentos confirmados, comidas, taxas de entrega, saídas e saldo; pagamentos pendentes não contam como recebidos.
- Contagem de chegada e entrega por dia; horários em São Paulo, taxas incluídas no total.
- Registro de gastos pelo responsável com proteção de repetição por chave.
- Etapas do cliente como linha de andamento adaptada ao celular; carrinho e histórico local preservados.

## 1.16.0 — Arquivos públicos

- Comentários removidos do código próprio e arquivos servidos; build mantém a limpeza.
- Licenças das dependências preservadas em arquivos fora da pasta pública.
- Servidor limita arquivos públicos aos formatos usados pelo site; arquivos internos, ocultos e sourcemaps bloqueados.
- DATA_DIR dentro de dist é rejeitado antes de criar arquivos privados.
- Testes verificam proteção da API e bloqueio de arquivo interno mesmo quando presente em dist.

## 1.15.0 — Confirmação e cancelamento

- Confirmação visível antes de enviar o pedido, com total e entrega/retirada; voltar mantém o carrinho.
- Cancelamento permitido apenas em Novo ou Aceito, com bloqueio também no servidor.
- Confirmação ao marcar como entregue; minimizar acompanhamento não cancela.

## 1.14.0 — Header, acompanhamento sem conta e proteção dos dados

- Header e menu centralizados; acompanha a rolagem; entrega e Meus pedidos no header.
- Histórico de até 20 identificadores no navegador; recolher não apaga; link privado para recuperar em outro aparelho.
- Cliente consulta itens/adicionais; telefone, endereço e observações completos ficam apenas no painel protegido.
- Conta do responsável com usuário e senha; API protegida; sem link de gestão na navegação pública.
- Consulta do pedido por identificador no corpo, CSP, anti-iframe, permissões e HTTPS/Secure/HSTS conforme hospedagem.
- Adicionais com preço por unidade no painel; testes de autorização, acesso a arquivos privados, minimização de dados e recuperação local.

## 1.13.0 — Painel e fila de pedidos

- API e SQLite persistente; total validado no servidor; tentativas repetidas sem duplicação.
- Cliente envia diretamente, informa contato/endereço e acompanha o status; WhatsApp permanece como alternativa.
- Painel com acesso por senha, fila, confirmação manual de pagamento e histórico.
- Controle de abertura, preparo, entrega e produtos esgotados; aviso sonoro com painel aberto.
- Testes de acesso, origem, preço, adicionais, duplicação, estoque, etapas e persistência após reiniciar.
- ZIP sem banco, senhas ou dados de clientes. Pagamento online permanece desativado.

# Histórico

## 1.0.0 — 2026-09-28

- Identidade carvão, amarelo, vermelho e creme; fontes Anton e DM Sans locais.
- Hero editorial, menu responsivo, navegação e área de localização provisória.
- Cardápio de exemplo com filtros e imagens WebP.
- Carrinho local e revisão de pedido de demonstração.
- Fontes, licenças, fotos, código editável e instruções para npx incluídos.
- Entrega local em ZIP; envio ao Google Drive adiado a pedido do usuário.

## 1.1.0 — 2026-09-28

- Cardápio transcrito da imagem: 9 hambúrgueres, 4 yakisobas e 1 cachorro-quente.
- Preços reais da referência, incluindo X-Burguer a R$ 7,00 e cachorro-quente a R$ 5,00.
- Fotos ilustrativas em todos os produtos; algumas compartilhadas por tipo.
- Retirados itens e preços fictícios de porções e bebidas.
- Adicionado telefone da referência; ingredientes preservados conforme impressos.
- Carrinho antigo reiniciado para evitar itens de demonstração após a troca de cardápio.

## 1.2.0 — 2026-09-29

- Hero adaptado dos dois prompts fornecidos do 21st.dev.
- Texto dividido, foto dominante e cartões de X-Tudo e Yakisoba de Frango.
- Expansão sutil da foto por scroll nativo com suporte a movimento reduzido.
- Cartões abrem as respectivas categorias; referências originais incluídas no pacote.

## 1.3.0 — 2026-09-29

- Entradas suaves de 360 ms no hero, destaques, títulos e produtos, inspiradas no stagger do Hero08 fornecido.
- Produtos entram uma vez ao aparecer; filtros acompanham a mesma linguagem.
- Transições de categorias, toque dos botões e zoom discreto dos destaques.
- Rolagem nativa preservada, sem esperas obrigatórias ou animações contínuas.
- Movimento reduzido substitui deslocamentos por um fade curto de 160 ms.

## 1.4.0 — 2026-09-29

- Navegação com ampliação por proximidade do mouse, adaptada do prompt Dock fornecido.
- Logo, links e botão de pedido crescem e retornam suavemente sem alterar o layout.
- Linha amarela acompanha o destaque dos links; foco de teclado também tem feedback.
- Dispositivos de toque usam os controles normais; movimento reduzido usa ampliação menor e transição curta.

## 1.5.0 — 2026-09-29

- Dock fixo no celular com Início, Cardápio e Localização, ícones e seção ativa.
- Movimento discreto ao tocar; respeita movimento reduzido.
- Carrinho elevado para não cobrir a navegação.
- Removido zoom por proximidade do menu desktop.

## 1.6.0 — 2026-09-29

- Integrado Dock real em React/TypeScript, Tailwind e Framer Motion.
- Magnificação por proximidade com mola, ícones Lucide e rótulos animados.
- Dock React no celular com destaque da seção atual e resposta ao toque.
- Incluídos fontes, dependências travadas e comandos de build.

## 1.7.0

- Painel do Dock envolve logo, navegação e botão de pedido no cabeçalho.
- Cardápio começa fechado, com botão abrir/fechar; atalhos abrem os produtos.

## 1.8.0

- Dock mobile com destaque que desliza, ícone ativo animado e mola ao toque.
- Marca Renato animada com Framer Motion e novo favicon com coroa.
- Seis pastéis a R$ 7 conforme solicitado, sabores pendentes.
- Acompanhamentos com batata e Bebidas com oito refrigerantes por tamanho; latas a R$ 5 e garrafas de 2 L a R$ 17,50.

## 1.9.0

- Navegação centralizada com Mais pedidos, WhatsApp e Instagram.
- Cabeçalho e botões respondem ao toque; Dock acompanha dedo.
- Filtros sem barra de rolagem visível; fotos do hero com mais espaço.
- Fotos WebP no lugar das ilustrações de comidas e bebidas.
- Sabores, acompanhamentos e adicionais de exemplo aprovados pelo usuário.
- Adicionais no carrinho com subtotal atualizado; pastéis e bebidas sem extras.
- Removidos avisos de demonstração; pedido abre rascunho no WhatsApp.
- Terça a domingo com confirmação de atendimento.

## 1.10.0

- Favoritos com cinco cards: dois acima e três abaixo; fotos e textos independentes.
- Correção de responsividade em celulares estreitos e tablets.
- Ícones vetoriais maiores e contornos mais visíveis; animação de entrada nos cards.
- Frase para o yakisoba, descrições curtas e fonte de destaque na introdução.
- Seis fotos ilustrativas geradas dos pastéis com mordida e recheio correspondente.
- Nova imagem da Coca-Cola lata e enquadramento uniforme das bebidas.
- Cheddar e bacon somente como adicionais da batata convencional.
- Barra do pedido arredondada, com rótulo centralizado sem deslocar ao tocar.

## 1.11.0

- WhatsApp em SVG preenchido, sem contorno duplicado ou ampliação do desenho.
- Footer React com entrada suave, links sociais e movimento ao tocar/passar o mouse.
- Navegação reordenada conforme as seções: Início, Favoritos, Cardápio, Local e redes sociais.

## 1.12.0

- Nav mobile com seis espaços iguais e ícones alinhados no mesmo tamanho.
- Cabeçalho segue o dedo com eventos touch nativos e retorno com mola.

## 1.18.0
- Cartões com gráficos de área baseados no prompt 21st, dados reais autenticados e filtro de até 31 dias.
- Datas inicial/final, atalhos Hoje/7/30, valores ao tocar/hover, animação respeitando movimento reduzido.
- Verificados build, TypeScript, três testes API e exibição de três gráficos em 390px sem overflow.

## 1.19.0
- Seletor de mês completo, Este mês e Mês anterior nos gráficos.
- Etapa atual com pulso e linha animada; pausa offline/finalizado e opção explícita Animar etapas para quem usa movimento reduzido.
- Painel reaberto no navegador local; testes e build aprovados.

## 1.20.0
- Stepper React do prompt integrado ao acompanhamento: check nas concluídas e Loader2 na etapa atual, mantendo estado vindo do servidor.
- Corrigidos erros de digitação e compatibilidade React 19 do componente fornecido; dependências Radix/CVA instaladas.
- Chart de área compacto conforme o prompt, filtro de mês preservado e resumo diário recolhido.
- Mobile 390px verificado, cinco etapas e três charts sem overflow; build, TypeScript e três testes aprovados.

## 1.20.1
- Removidos texto de espera e controle de animação do acompanhamento.
- Indicador da etapa atual gira automaticamente, sem escolha do cliente; pausa offline e termina com o pedido.

## 1.21.2
- Header mobile com menos desfoque/escala sem retirar interação.
- Calendários removidos, atalho Este ano e resumo diário em barras.
- Web Push com assinatura autenticada, destinos limitados a serviços de push e botão de teste; QR Pix manual com senha para alterar configuração.
- Cinco testes aprovados, incluindo Pix, proteção de endpoints e consolidação anual. Teste de som acionado no navegador; notificação real pendente de permissão e teste no celular.

## 1.22.0
- Editor de produtos, fotos HTTPS e adicionais por categoria no painel autenticado.
- Cardápio persistente e preços calculados pelo servidor; pedidos existentes preservados.
- Pix antecipado exige confirmação antes do aceite; Pix na retirada/entrega segue pendente.

## 1.23.0
- Painel simplificado em Pedidos, Caixa e Minha loja; fila como tela inicial.
- Fotos escolhidas no celular e adicionais em campos separados.
- Guia do responsável, Docker e instruções Cloudflare com armazenamento persistente.
- Correção do limite de tentativas atrás de proxy confiável, encontrado na revisão Codex Security.
