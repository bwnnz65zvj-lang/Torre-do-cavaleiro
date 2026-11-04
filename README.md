# Torre do Cavaleiro — vila online
Protótipo de presença para até 4 jogadores por sala. Paladino e arqueiro 3D com movimentação e animações visíveis aos amigos. Casas camponesas incluídas.

## Publicar no Render
Envie package.json, server.js e a pasta public para a raiz do repositório. Não envie um ZIP fechado.
Language: Node. Branch: main. Root Directory: vazio. Build Command: npm install. Start Command: npm start. Plano: Free. Health Check Path: /health.
O jogo e o servidor ficam no mesmo serviço; Vercel não é necessária para este teste.

## Jogar
Abra o link HTTPS do Render, escolha sua classe, preencha nome e sala e clique Entrar na sala. Envie o mesmo link e código de sala ao amigo. Duas abas também permitem testar.

## Limites desta versão
Somente presença e movimento na vila são compartilhados. A cripta é bloqueada enquanto conectado; saia da sala para jogar solo. Combate, loot, barris e inventários não são sincronizados. Salas são temporárias, sem contas nem salvamento. O servidor retransmite posições validadas em formato e limites do mapa; não é ainda uma simulação autoritativa com proteção contra trapaça. Reinícios desconectam jogadores, que podem entrar novamente.

## Rodar no computador
Com Node.js 22 ou superior: npm install, depois npm start. Abra http://localhost:3000.
