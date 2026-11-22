# Batalha de Heróis — Arena Edition (Web + Online 1v1)

Versão Web completa do projeto **Batalha de Heróis** (UFRPE / UAST), pronta para publicar gratuitamente no **GitHub Pages** e jogar online em tempo real com amigos pelo navegador.

## Arquivos do Pacote
- `index.html` — Estrutura completa com todas as telas (Início, Sala Online 1v1, Cadastro, Elenco, Seleção, Versus, Arena e Vitória).
- `style.css` — Visual escuro estilo Arena Neon, cards responsivos e animações.
- `game.js` — Motor de combate (Raiva, Nível de Poder, 4 golpes desbloqueáveis, crítico aleatório 80%/100%/110%), Canvas 60 FPS, sintetizador de áudio Web Audio e conexão Multiplayer Online 1v1 via WebRTC (PeerJS).

## Como publicar no GitHub Pages (Passo a Passo)
1. Acesse [github.com](https://github.com) e clique em **New repository** (ex.: `batalha-de-herois`).
2. Deixe como **Public** e clique em **Create repository**.
3. Clique em **uploading an existing file** e envie os 3 arquivos (`index.html`, `style.css`, `game.js`) na raiz do repositório, depois clique em **Commit changes**.
4. No repositório, vá em **Settings > Pages**.
5. Em **Build and deployment > Branch**, selecione **`main`** (pasta `/ (root)`) e clique em **Save**.
6. Aguarde cerca de 1 minuto e atualize a página: o GitHub exibirá o seu link público (ex.: `https://seu-usuario.github.io/batalha-de-herois/`).

## Como jogar Online 1v1 com seu amigo
1. Abra o link do seu GitHub Pages e clique em **JOGAR ONLINE 1v1 (COM AMIGO)**.
2. Escolha seu **Herói** e clique em **CRIAR SALA** — aparecerá um código de 4 números e o botão **COPIAR LINK**.
3. Envie o link (ou o código) para o seu amigo.
4. Ele escolhe o **Vilão**, entra na sala e vocês batalham ao vivo em turnos alternados!
