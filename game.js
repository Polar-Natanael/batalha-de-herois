// ============================================================================
// BATALHA DE HERÓIS — ARENA EDITION (WEB + MULTIPLAYER ONLINE 1v1 VIA WEBRTC)
// ============================================================================

const STORAGE_KEY = 'batalha_herois_elenco_v1';
const PEER_PREFIX = 'ufrpe-uast-batalha-herois-';

const GOLPES_HEROI = [
  { nome: 'Golpe Heroico', desc: 'Ataque ágil que acumula Raiva e Nível de Poder.', mult: 1.00, minRaiva: 0, minPoder: 0, custoRaiva: 0, custoPoder: 0, ganhoRaiva: 25, ganhoPoder: 25 },
  { nome: 'Raio Estelar', desc: 'Disparo de energia pura que exige 40 de Nível de Poder.', mult: 1.35, minRaiva: 0, minPoder: 40, custoRaiva: 0, custoPoder: 40, ganhoRaiva: 15, ganhoPoder: 0 },
  { nome: 'Fúria Guardiã', desc: 'Contra-ataque intenso liberado ao atingir 50 de Raiva.', mult: 1.70, minRaiva: 50, minPoder: 0, custoRaiva: 50, custoPoder: 0, ganhoRaiva: 0, ganhoPoder: 10 },
  { nome: 'Juízo Final Solar', desc: 'Golpe Supremo! Requer 80 de Raiva e 70 de Nível de Poder.', mult: 2.25, minRaiva: 80, minPoder: 70, custoRaiva: 80, custoPoder: 70, ganhoRaiva: 0, ganhoPoder: 0 }
];

const GOLPES_VILAO = [
  { nome: 'Garra Sombria', desc: 'Investida rápida que alimenta a Raiva e o Poder maligno.', mult: 1.00, minRaiva: 0, minPoder: 0, custoRaiva: 0, custoPoder: 0, ganhoRaiva: 25, ganhoPoder: 25 },
  { nome: 'Explosão do Caos', desc: 'Onda sombria que exige 40 de Nível de Poder.', mult: 1.35, minRaiva: 0, minPoder: 40, custoRaiva: 0, custoPoder: 40, ganhoRaiva: 15, ganhoPoder: 0 },
  { nome: 'Ira Destruidora', desc: 'Explosão de fúria liberada ao atingir 50 de Raiva.', mult: 1.70, minRaiva: 50, minPoder: 0, custoRaiva: 50, custoPoder: 0, ganhoRaiva: 0, ganhoPoder: 10 },
  { nome: 'Apocalipse Sombrio', desc: 'Golpe Supremo! Requer 80 de Raiva e 70 de Nível de Poder.', mult: 2.25, minRaiva: 80, minPoder: 70, custoRaiva: 80, custoPoder: 70, ganhoRaiva: 0, ganhoPoder: 0 }
];

const PERSONAGENS_INICIAIS = [
  { id: 1, tipo: 'HEROI', nome: 'Solarius', genero: 'MASCULINO', vidaMaxima: 120, ataque: 32, defesa: 12 },
  { id: 2, tipo: 'HEROI', nome: 'Valquíria Nova', genero: 'FEMININO', vidaMaxima: 110, ataque: 36, defesa: 10 },
  { id: 3, tipo: 'HEROI', nome: 'Ciborgue Alfa', genero: 'OUTRO', vidaMaxima: 135, ataque: 28, defesa: 16 },
  { id: 4, tipo: 'VILAO', nome: 'Malakor', genero: 'MASCULINO', vidaMaxima: 125, ataque: 34, defesa: 11 },
  { id: 5, tipo: 'VILAO', nome: 'Morgana Sombria', genero: 'FEMININO', vidaMaxima: 105, ataque: 39, defesa: 9 },
  { id: 6, tipo: 'VILAO', nome: 'Titã de Ferro', genero: 'NAO_INFORMAR', vidaMaxima: 145, ataque: 27, defesa: 18 }
];

// ==================== SISTEMA DE ÁUDIO (WEB AUDIO API) ====================
const SoundFX = (() => {
  let muted = false;
  let ctx = null;

  function getCtx() {
    if (!ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) ctx = new AudioContext();
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function playSeq(freqs, durations, volume = 0.14) {
    if (muted) return;
    const ac = getCtx();
    if (!ac) return;
    let time = ac.currentTime;
    freqs.forEach((f, idx) => {
      const dur = durations[idx] / 1000;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, time);
      gain.gain.setValueAtTime(volume, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start(time);
      osc.stop(time + dur);
      time += dur;
    });
  }

  return {
    toggleMute() { muted = !muted; return muted; },
    isMuted() { return muted; },
    click() { playSeq([680], [45], 0.10); },
    roulette() { playSeq([520], [35], 0.08); },
    hit(heavy) {
      if (heavy) playSeq([240, 160, 110], [45, 55, 95], 0.18);
      else playSeq([320, 210], [40, 55], 0.13);
    },
    block() { playSeq([880, 1120], [35, 55], 0.10); },
    ko() { playSeq([300, 220, 150, 95], [70, 80, 90, 170], 0.18); },
    victory() { playSeq([523, 659, 784, 1046], [90, 90, 90, 240], 0.16); }
  };
})();

// ==================== ESTADO GLOBAL DO JOGO ====================
let elenco = carregarElenco();

const match = {
  online: false,
  role: 'LOCAL', // 'LOCAL' | 'HOST' | 'GUEST'
  heroi: null,
  vilao: null,
  rodadaAtual: 0,
  vitoriasHeroi: 0,
  vitoriasVilao: 0,
  vencedorAnterior: null, // 'HEROI' | 'VILAO' | null
  turnoAtual: null,       // 'HEROI' | 'VILAO'
  aguardandoInput: false,
  aguardandoRemoto: false,
  modoManual: true,
  rapido: false,
  totalGolpes: 0,
  maiorDano: 0,
  autorMaiorDano: '-',
  timers: []
};

const net = {
  peer: null,
  conn: null,
  roomCode: '',
  remoteFighter: null
};

// ==================== FUNÇÕES AUXILIARES DE MODELO ====================
function carregarElenco() {
  try {
    const salvo = localStorage.getItem(STORAGE_KEY);
    if (salvo) {
      const parsed = JSON.parse(salvo);
      if (Array.isArray(parsed) && parsed.length >= 2) return parsed;
    }
  } catch (e) {}
  return JSON.parse(JSON.stringify(PERSONAGENS_INICIAIS));
}

function salvarElenco() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(elenco));
  } catch (e) {}
}

function getCategoriaTexto(p) {
  if (p.tipo === 'HEROI') return p.genero === 'FEMININO' ? 'Heroína' : 'Herói';
  return p.genero === 'FEMININO' ? 'Vilã' : 'Vilão';
}

function getGeneroTexto(g) {
  return {
    MASCULINO: 'Masculino',
    FEMININO: 'Feminino',
    OUTRO: 'Outro',
    NAO_INFORMAR: 'Prefiro não informar'
  }[g] || g;
}

function criarLutadorCombate(base) {
  return {
    ...base,
    categoria: getCategoriaTexto(base),
    vidaAtual: base.vidaMaxima,
    raiva: 0,
    nivelPoder: 20,
    golpes: JSON.parse(JSON.stringify(base.tipo === 'HEROI' ? GOLPES_HEROI : GOLPES_VILAO))
  };
}

function podeUsarGolpe(lutador, golpe) {
  return lutador.raiva >= golpe.minRaiva && lutador.nivelPoder >= golpe.minPoder;
}

function escolherMelhorGolpeIA(lutador) {
  let melhor = lutador.golpes[0];
  for (const g of lutador.golpes) {
    if (podeUsarGolpe(lutador, g) && g.mult >= melhor.mult) melhor = g;
  }
  return melhor;
}

// ==================== NAVEGAÇÃO ENTRE TELAS ====================
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(id);
  if (target) target.classList.add('active');

  if (id === 'screen-home') atualizarContadorHome();
  if (id === 'screen-roster') renderizarElenco();
  if (id === 'screen-select') preencherSelectsCombate();
  if (id === 'screen-online') preencherSelectsOnline();
}

document.querySelectorAll('[data-nav]').forEach(btn => {
  btn.addEventListener('click', () => {
    SoundFX.click();
    limparTimers();
    if (btn.dataset.nav === 'screen-home' && match.online) encerrarConexaoOnline();
    showScreen(btn.dataset.nav);
  });
});

function atualizarContadorHome() {
  const h = elenco.filter(p => p.tipo === 'HEROI').length;
  const v = elenco.filter(p => p.tipo === 'VILAO').length;
  document.getElementById('home-roster-status').textContent =
    `● Elenco pronto para combate: ${h} Herói(s) e ${v} Vilão(ões)`;
}

// ==================== TELA CADASTRO ====================
const regCat = document.getElementById('reg-category');
const regName = document.getElementById('reg-name');
const regGender = document.getElementById('reg-gender');
const regHp = document.getElementById('reg-hp');
const regAtk = document.getElementById('reg-atk');
const regDef = document.getElementById('reg-def');

function atualizarPreviewCadastro() {
  const isHeroi = regCat.value === 'HEROI';
  const gen = regGender.value;
  const cat = isHeroi ? (gen === 'FEMININO' ? 'HEROÍNA' : 'HERÓI') : (gen === 'FEMININO' ? 'VILÃ' : 'VILÃO');

  const card = document.getElementById('preview-card');
  card.className = `card preview-panel ${isHeroi ? 'card-hero' : 'card-villain'}`;

  const prevCat = document.getElementById('prev-category');
  prevCat.textContent = `★ ${cat} ★`;
  prevCat.className = `preview-cat ${isHeroi ? 'text-hero' : 'text-villain'}`;

  document.getElementById('prev-name').textContent = regName.value.trim() || 'Novo Lutador';
  document.getElementById('prev-gender').textContent = `Gênero: ${getGeneroTexto(gen)}`;

  const hp = Number(regHp.value);
  const atk = Number(regAtk.value);
  const def = Number(regDef.value);

  document.getElementById('val-hp').textContent = `${hp} HP`;
  document.getElementById('val-atk').textContent = `${atk} ATK`;
  document.getElementById('val-def').textContent = `${def} DEF`;

  document.getElementById('prev-hp-txt').textContent = `${hp} / 250`;
  document.getElementById('prev-atk-txt').textContent = `${atk} / 80`;
  document.getElementById('prev-def-txt').textContent = `${def} / 50`;

  document.getElementById('prev-hp-bar').style.width = `${(hp / 250) * 100}%`;
  document.getElementById('prev-atk-bar').style.width = `${(atk / 80) * 100}%`;
  document.getElementById('prev-def-bar').style.width = `${(def / 50) * 100}%`;

  const poderTotal = Math.floor(hp / 4) + atk + def;
  let rank = 'Classificação: ★ DESAFIANTE';
  if (poderTotal >= 115) rank = 'Classificação: ★★★ LENDÁRIO';
  else if (poderTotal >= 85) rank = 'Classificação: ★★ ELITE';
  document.getElementById('prev-rank').textContent = rank;
}

[regCat, regGender, regHp, regAtk, regDef].forEach(el => el.addEventListener('input', atualizarPreviewCadastro));
regName.addEventListener('input', atualizarPreviewCadastro);

document.getElementById('register-form').addEventListener('submit', e => {
  e.preventDefault();
  const nome = regName.value.trim();
  if (!nome) return;
  const novo = {
    id: elenco.length ? Math.max(...elenco.map(p => p.id)) + 1 : 1,
    tipo: regCat.value,
    nome,
    genero: regGender.value,
    vidaMaxima: Number(regHp.value),
    ataque: Number(regAtk.value),
    defesa: Number(regDef.value)
  };
  elenco.push(novo);
  salvarElenco();
  SoundFX.victory();
  regName.value = '';
  atualizarPreviewCadastro();
  alert(`${getCategoriaTexto(novo)} "${novo.nome}" cadastrado(a) com sucesso!`);
});

// ==================== TELA ELENCO ====================
function renderizarElenco() {
  const heroesList = document.getElementById('roster-heroes-list');
  const villainsList = document.getElementById('roster-villains-list');
  heroesList.innerHTML = '';
  villainsList.innerHTML = '';

  elenco.forEach(p => {
    const isHero = p.tipo === 'HEROI';
    const div = document.createElement('div');
    div.className = 'roster-item';
    div.innerHTML = `
      <div class="roster-item-top">
        <span class="${isHero ? 'text-hero' : 'text-villain'}">#${p.id} &nbsp;${p.nome} (${getCategoriaTexto(p)})</span>
        <span class="mono text-green">MAX</span>
      </div>
      <div class="roster-item-stats">
        <span class="text-green">❤ Vida: ${p.vidaMaxima}</span>
        <span class="text-villain">⚔ Ataque: ${p.ataque}</span>
        <span class="text-hero">🛡 Defesa: ${p.defesa}</span>
        <span class="muted">• ${getGeneroTexto(p.genero)}</span>
      </div>
    `;
    (isHero ? heroesList : villainsList).appendChild(div);
  });
}

// ==================== SELEÇÃO LOCAL & VERSUS ====================
const selHero = document.getElementById('select-hero');
const selVillain = document.getElementById('select-villain');

function preencherSelectsCombate() {
  const herois = elenco.filter(p => p.tipo === 'HEROI');
  const viloes = elenco.filter(p => p.tipo === 'VILAO');
  selHero.innerHTML = herois.map(h => `<option value="${h.id}">#${h.id} - ${h.nome}</option>`).join('');
  selVillain.innerHTML = viloes.map(v => `<option value="${v.id}">#${v.id} - ${v.nome}</option>`).join('');
  atualizarDetalhesSelecao();
}

function atualizarDetalhesSelecao() {
  const h = elenco.find(p => p.id === Number(selHero.value));
  const v = elenco.find(p => p.id === Number(selVillain.value));
  if (h) document.getElementById('select-hero-details').innerHTML = formatarFichaHtml(h);
  if (v) document.getElementById('select-villain-details').innerHTML = formatarFichaHtml(v);
}

function formatarFichaHtml(p) {
  return `
    <div><span class="muted">Categoria:</span> <strong>${getCategoriaTexto(p)}</strong></div>
    <div><span class="muted">Gênero:</span> ${getGeneroTexto(p.genero)}</div>
    <div class="text-green mono">❤ VIDA: ${p.vidaMaxima} HP</div>
    <div class="text-villain mono">⚔ ATAQUE: ${p.ataque}</div>
    <div class="text-hero mono">🛡 DEFESA: ${p.defesa}</div>
  `;
}

selHero.addEventListener('change', atualizarDetalhesSelecao);
selVillain.addEventListener('change', atualizarDetalhesSelecao);

document.getElementById('btn-to-versus').addEventListener('click', () => {
  SoundFX.click();
  const h = elenco.find(p => p.id === Number(selHero.value));
  const v = elenco.find(p => p.id === Number(selVillain.value));
  if (!h || !v) return;
  match.online = false;
  match.role = 'LOCAL';
  abrirTelaVersus(h, v);
});

function abrirTelaVersus(baseHeroi, baseVilao) {
  match.heroi = criarLutadorCombate(baseHeroi);
  match.vilao = criarLutadorCombate(baseVilao);

  document.getElementById('vs-card-hero').innerHTML = `
    <div class="vs-avatar" style="background: rgba(56,189,248,0.18); color: var(--hero);">🦸</div>
    <div class="text-hero" style="font-weight:800; font-size:0.85rem;">${match.heroi.categoria.toUpperCase()}</div>
    <h3 style="font-size:1.6rem; margin:6px 0 14px;">${match.heroi.nome}</h3>
    <div class="mono text-green">VIDA: ${match.heroi.vidaMaxima} HP</div>
    <div class="mono text-villain">ATAQUE: ${match.heroi.ataque}</div>
    <div class="mono text-hero">DEFESA: ${match.heroi.defesa}</div>
  `;

  document.getElementById('vs-card-villain').innerHTML = `
    <div class="vs-avatar" style="background: rgba(244,63,94,0.18); color: var(--villain);">🦹</div>
    <div class="text-villain" style="font-weight:800; font-size:0.85rem;">${match.vilao.categoria.toUpperCase()}</div>
    <h3 style="font-size:1.6rem; margin:6px 0 14px;">${match.vilao.nome}</h3>
    <div class="mono text-green">VIDA: ${match.vilao.vidaMaxima} HP</div>
    <div class="mono text-villain">ATAQUE: ${match.vilao.ataque}</div>
    <div class="mono text-hero">DEFESA: ${match.vilao.defesa}</div>
  `;

  const btnStart = document.getElementById('btn-start-fight');
  const waitMsg = document.getElementById('vs-wait-msg');
  if (match.online && match.role === 'GUEST') {
    btnStart.classList.add('hidden');
    waitMsg.classList.remove('hidden');
  } else {
    btnStart.classList.remove('hidden');
    waitMsg.classList.add('hidden');
  }

  SoundFX.hit(false);
  showScreen('screen-versus');
}

document.getElementById('btn-start-fight').addEventListener('click', () => {
  SoundFX.click();
  if (match.online && match.role === 'HOST') {
    enviarMensagemRede({ type: 'START_MATCH' });
  }
  iniciarSerieCombate();
});

// ==================== MULTIPLAYER ONLINE 1v1 (PEERJS / WEBRTC) ====================
function preencherSelectsOnline() {
  const herois = elenco.filter(p => p.tipo === 'HEROI');
  const viloes = elenco.filter(p => p.tipo === 'VILAO');
  document.getElementById('online-host-hero').innerHTML =
    herois.map(h => `<option value="${h.id}">#${h.id} - ${h.nome} (HP ${h.vidaMaxima} | ATK ${h.ataque})</option>`).join('');
  document.getElementById('online-guest-villain').innerHTML =
    viloes.map(v => `<option value="${v.id}">#${v.id} - ${v.nome} (HP ${v.vidaMaxima} | ATK ${v.ataque})</option>`).join('');
}

function encerrarConexaoOnline() {
  if (net.conn) { try { net.conn.close(); } catch (e) {} net.conn = null; }
  if (net.peer) { try { net.peer.destroy(); } catch (e) {} net.peer = null; }
  match.online = false;
  match.role = 'LOCAL';
}

function enviarMensagemRede(payload) {
  if (net.conn && net.conn.open) {
    net.conn.send(payload);
  }
}

document.getElementById('btn-create-room').addEventListener('click', () => {
  SoundFX.click();
  if (typeof Peer === 'undefined') {
    document.getElementById('host-status').textContent = 'Erro: biblioteca PeerJS não carregou. Verifique sua internet.';
    return;
  }
  encerrarConexaoOnline();
  const code = String(Math.floor(1000 + Math.random() * 9000));
  net.roomCode = code;
  document.getElementById('host-room-code').textContent = code;
  document.getElementById('host-status').textContent = 'Conectando servidor de sinalização...';

  const peer = new Peer(PEER_PREFIX + code, { config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] } });
  net.peer = peer;

  peer.on('open', () => {
    document.getElementById('host-status').textContent = '🟢 Sala aberta! Aguardando seu amigo digitar o código...';
    document.getElementById('btn-copy-link').disabled = false;
  });

  peer.on('connection', conn => {
    net.conn = conn;
    configurarEventosConexao(conn, 'HOST');
  });

  peer.on('error', err => {
    document.getElementById('host-status').textContent = 'Erro na sala: ' + err.type + '. Tente criar novamente.';
  });
});

document.getElementById('btn-copy-link').addEventListener('click', () => {
  SoundFX.click();
  const url = new URL(window.location.href);
  url.searchParams.set('sala', net.roomCode);
  navigator.clipboard.writeText(url.toString()).then(() => {
    document.getElementById('host-status').textContent = '✅ Link com código copiado! Cole no WhatsApp/Discord do seu amigo.';
  }).catch(() => {
    document.getElementById('host-status').textContent = `Envie o código ${net.roomCode} para seu amigo!`;
  });
});

document.getElementById('btn-join-room').addEventListener('click', () => {
  SoundFX.click();
  const rawCode = document.getElementById('guest-room-input').value.trim().replace(/\D/g, '');
  if (rawCode.length < 4) {
    document.getElementById('guest-status').textContent = 'Digite os 4 números do código da sala!';
    return;
  }
  if (typeof Peer === 'undefined') {
    document.getElementById('guest-status').textContent = 'Erro: biblioteca PeerJS não carregou.';
    return;
  }

  encerrarConexaoOnline();
  document.getElementById('guest-status').textContent = 'Conectando à sala ' + rawCode + '...';

  const peer = new Peer({ config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] } });
  net.peer = peer;

  peer.on('open', () => {
    const conn = peer.connect(PEER_PREFIX + rawCode, { reliable: true });
    net.conn = conn;
    configurarEventosConexao(conn, 'GUEST');
  });

  peer.on('error', err => {
    document.getElementById('guest-status').textContent = 'Não foi possível conectar (' + err.type + '). Confira o código.';
  });
});

function configurarEventosConexao(conn, role) {
  conn.on('open', () => {
    match.online = true;
    match.role = role;
    SoundFX.victory();

    if (role === 'GUEST') {
      document.getElementById('guest-status').textContent = '🟢 Conectado! Enviando lutador...';
      const vilaoEscolhido = elenco.find(p => p.id === Number(document.getElementById('online-guest-villain').value));
      enviarMensagemRede({ type: 'HELLO_GUEST', vilao: vilaoEscolhido });
    } else {
      document.getElementById('host-status').textContent = '🟢 Amigo conectado! Preparando arena...';
    }
  });

  conn.on('data', data => processarMensagemRede(data));

  conn.on('close', () => {
    if (match.online) {
      alert('A conexão com o outro jogador foi encerrada.');
      encerrarConexaoOnline();
      showScreen('screen-home');
    }
  });
}

function processarMensagemRede(msg) {
  if (!msg || !msg.type) return;

  if (msg.type === 'HELLO_GUEST' && match.role === 'HOST') {
    const heroiEscolhido = elenco.find(p => p.id === Number(document.getElementById('online-host-hero').value));
    const vilaoEscolhido = msg.vilao;
    enviarMensagemRede({ type: 'SETUP_VERSUS', heroi: heroiEscolhido, vilao: vilaoEscolhido });
    abrirTelaVersus(heroiEscolhido, vilaoEscolhido);
  } else if (msg.type === 'SETUP_VERSUS' && match.role === 'GUEST') {
    abrirTelaVersus(msg.heroi, msg.vilao);
  } else if (msg.type === 'START_MATCH' && match.role === 'GUEST') {
    iniciarSerieCombate();
  } else if (msg.type === 'ROUND_INITIATIVE' && match.role === 'GUEST') {
    aplicarIniciativaRodada(msg.iniciador, msg.comRoleta);
  } else if (msg.type === 'REQUEST_MOVE' && match.role === 'HOST') {
    // O convidado (Vilão) escolheu um golpe; o Host valida, rola o multiplicador e devolve o resultado exato
    if (match.turnoAtual === 'VILAO' && match.aguardandoRemoto) {
      match.aguardandoRemoto = false;
      const golpe = match.vilao.golpes[msg.moveIndex] || match.vilao.golpes[0];
      resolverGolpeAutoritativo('VILAO', msg.moveIndex, golpe);
    }
  } else if (msg.type === 'APPLY_STRIKE' && match.role === 'GUEST') {
    aplicarResultadoGolpeSincronizado(msg);
  } else if (msg.type === 'EMOTE') {
    ArenaEngine.mostrarEmote(msg.from === 'HEROI', msg.text);
    SoundFX.click();
  } else if (msg.type === 'REMATCH' && match.role === 'GUEST') {
    iniciarSerieCombate();
  }
}

// ==================== MOTOR DE COMBATE & ARENA ====================
const ArenaEngine = (() => {
  const canvas = document.getElementById('arena-canvas');
  const ctx = canvas.getContext('2d');

  let animId = null;
  let tempo = 0;
  let dashHeroi = 0;
  let dashVilao = 0;
  let flashHeroi = 0;
  let flashVilao = 0;
  let screenShake = 0;
  let golpeEspecialAtivo = false;
  let heroiNocauteado = false;
  let vilaoNocauteado = false;

  let vidaExibidaHeroi = 100;
  let vidaExibidaVilao = 100;
  let raivaExibidaHeroi = 0;
  let poderExibidoHeroi = 20;
  let raivaExibidaVilao = 0;
  let poderExibidoVilao = 20;

  let bannerTexto = '';
  let bannerCor = '#facc15';

  let textos = [];
  let faiscas = [];
  let ondas = [];
  let emotes = [];

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(600, rect.width * dpr);
    canvas.height = Math.max(240, rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  window.addEventListener('resize', () => {
    if (document.getElementById('screen-arena').classList.contains('active')) resize();
  });

  function resetarRound() {
    resize();
    if (!match.heroi || !match.vilao) return;
    vidaExibidaHeroi = match.heroi.vidaMaxima;
    vidaExibidaVilao = match.vilao.vidaMaxima;
    raivaExibidaHeroi = match.heroi.raiva;
    poderExibidoHeroi = match.heroi.nivelPoder;
    raivaExibidaVilao = match.vilao.raiva;
    poderExibidoVilao = match.vilao.nivelPoder;
    dashHeroi = 0;
    dashVilao = 0;
    flashHeroi = 0;
    flashVilao = 0;
    screenShake = 0;
    golpeEspecialAtivo = false;
    heroiNocauteado = false;
    vilaoNocauteado = false;
    bannerTexto = '';
    textos = [];
    faiscas = [];
    ondas = [];
    emotes = [];
  }

  function definirBanner(texto, cor = '#facc15') {
    bannerTexto = texto;
    bannerCor = cor;
  }

  function mostrarEmote(isHeroi, texto) {
    const w = canvas.clientWidth || 900;
    const h = canvas.clientHeight || 340;
    emotes.push({
      texto,
      x: isHeroi ? w * 0.26 : w * 0.74,
      y: h * 0.42,
      vida: 1.0
    });
  }

  function gerarFaiscas(x, y, cor, qtd) {
    for (let i = 0; i < qtd; i++) {
      const ang = Math.random() * Math.PI * 2;
      const vel = 2.5 + Math.random() * 7.2;
      faiscas.push({ x, y, vx: Math.cos(ang) * vel, vy: Math.sin(ang) * vel, cor, vida: 1.0 });
    }
  }

  function animarAtaque(atacanteEhHeroi, nomeGolpe, mult, dano, vidaRestante, percentual) {
    const w = canvas.clientWidth || 900;
    const h = canvas.clientHeight || 340;
    const yImpacto = h * 0.55;

    const isEspecial = mult >= 1.35;
    const isSupremo = mult >= 2.0;
    golpeEspecialAtivo = isEspecial;

    let tagMult = '• NORMAL • 100% ATK';
    let corTag = '#f1f5f9';
    let qtdFaiscas = isSupremo ? 45 : (isEspecial ? 30 : 20);
    let bonusShake = isSupremo ? 9 : (isEspecial ? 4 : 0);

    if (percentual === 110) {
      tagMult = '⚡ CRÍTICO • 110% ATK';
      corTag = '#facc15';
      qtdFaiscas = isSupremo ? 55 : 36;
      bonusShake = isSupremo ? 12 : 7;
    } else if (percentual === 80) {
      tagMult = '☁ FRACO • 80% ATK';
      corTag = '#94a3b8';
      qtdFaiscas = isEspecial ? 22 : 12;
      bonusShake = isEspecial ? 3 : -2;
    }

    const tituloGolpe = (isSupremo ? '💥 ' : (isEspecial ? '★ ' : '')) + nomeGolpe.toUpperCase();
    const corGolpe = isSupremo ? '#facc15' : (isEspecial ? '#a855f7' : '#f1f5f9');

    if (atacanteEhHeroi) {
      dashHeroi = 1.0;
      flashVilao = 1.0;
      const xAlvo = w * 0.74;
      const msg = dano === 1 ? 'DEFESA ALTA! -1 HP' : `-${dano} HP`;
      const corTxt = (percentual === 110 || isSupremo) ? '#facc15' : (dano === 1 ? '#38bdf8' : '#22c55e');

      textos.push({ texto: tituloGolpe, x: xAlvo, y: yImpacto - 115, cor: corGolpe, size: isSupremo ? 18 : 15, vida: 1.0 });
      textos.push({ texto: tagMult, x: xAlvo, y: yImpacto - 92, cor: corTag, size: 13, vida: 1.0 });
      textos.push({ texto: msg, x: xAlvo, y: yImpacto - 64, cor: corTxt, size: isSupremo ? 27 : 22, vida: 1.0 });

      const corPart = isSupremo ? '#facc15' : (isEspecial ? '#a855f7' : '#38bdf8');
      gerarFaiscas(xAlvo, yImpacto, corPart, qtdFaiscas);
      if (isEspecial) ondas.push({ x: xAlvo, y: yImpacto - 35, raio: 16, raioMax: isSupremo ? 160 : 110, cor: corPart, vida: 1.0 });
      if (vidaRestante <= 0) vilaoNocauteado = true;
    } else {
      dashVilao = 1.0;
      flashHeroi = 1.0;
      const xAlvo = w * 0.26;
      const msg = dano === 1 ? 'DEFESA ALTA! -1 HP' : `-${dano} HP`;
      const corTxt = (percentual === 110 || isSupremo) ? '#facc15' : (dano === 1 ? '#38bdf8' : '#f43f5e');

      textos.push({ texto: tituloGolpe, x: xAlvo, y: yImpacto - 115, cor: corGolpe, size: isSupremo ? 18 : 15, vida: 1.0 });
      textos.push({ texto: tagMult, x: xAlvo, y: yImpacto - 92, cor: corTag, size: 13, vida: 1.0 });
      textos.push({ texto: msg, x: xAlvo, y: yImpacto - 64, cor: corTxt, size: isSupremo ? 27 : 22, vida: 1.0 });

      const corPart = isSupremo ? '#facc15' : (isEspecial ? '#a855f7' : '#f43f5e');
      gerarFaiscas(xAlvo, yImpacto, corPart, qtdFaiscas);
      if (isEspecial) ondas.push({ x: xAlvo, y: yImpacto - 35, raio: 16, raioMax: isSupremo ? 160 : 110, cor: corPart, vida: 1.0 });
      if (vidaRestante <= 0) heroiNocauteado = true;
    }

    screenShake = Math.max(4, Math.min(25, 6 + dano * 0.25 + bonusShake));
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  }

  function desenharHudLutador(p, x, y, w, vidaExibida, raivaExibida, poderExibido, corTema) {
    ctx.fillStyle = 'rgba(20, 27, 45, 0.9)';
    roundRect(x, y, w, 98, 14);
    ctx.fill();
    ctx.strokeStyle = corTema;
    ctx.lineWidth = 1.8;
    ctx.stroke();

    ctx.font = 'bold 14px Segoe UI, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText(`${p.nome} (${p.categoria})`, x + 12, y + 21);

    let stTexto = 'EM BATALHA';
    if (p.vidaAtual <= 0) stTexto = 'DESTRUÍDO';
    else if (p.vidaAtual >= p.vidaMaxima) stTexto = 'MAX';

    ctx.font = 'bold 12px Consolas, monospace';
    ctx.fillStyle = stTexto === 'DESTRUÍDO' ? '#f43f5e' : corTema;
    ctx.textAlign = 'right';
    ctx.fillText(stTexto, x + w - 12, y + 21);

    // Barra HP
    const barX = x + 12;
    const barY = y + 29;
    const barW = w - 24;
    const barH = 18;
    ctx.fillStyle = '#0b0f19';
    roundRect(barX, barY, barW, barH, 9);
    ctx.fill();

    const pct = Math.max(0, Math.min(1, vidaExibida / p.vidaMaxima));
    ctx.fillStyle = pct > 0.5 ? '#22c55e' : (pct > 0.25 ? '#eab308' : '#f43f5e');
    roundRect(barX, barY, barW * pct, barH, 9);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.max(0, Math.round(vidaExibida))} / ${p.vidaMaxima} HP`, barX + barW / 2, barY + 13);

    // Mini barras Raiva e Poder
    const subY = y + 53;
    const halfW = (barW - 8) / 2;
    desenharMiniBarra(barX, subY, halfW, 15, raivaExibida, 100, '#f97316', `🔥 RAIVA ${Math.round(raivaExibida)}%`);
    desenharMiniBarra(barX + halfW + 8, subY, halfW, 15, poderExibido, 100, '#a855f7', `⚡ PODER ${Math.round(poderExibido)}%`);

    ctx.font = '11px Segoe UI, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'left';
    ctx.fillText(`ATK Base: ${p.ataque}   |   DEF: ${p.defesa}`, x + 12, y + 86);
  }

  function desenharMiniBarra(x, y, w, h, val, max, cor, label) {
    ctx.fillStyle = '#0b0f19';
    roundRect(x, y, w, h, 7);
    ctx.fill();
    const pct = Math.max(0, Math.min(1, val / max));
    ctx.fillStyle = cor;
    roundRect(x, y, w * pct, h, 7);
    ctx.fill();

    ctx.font = 'bold 10px Consolas, monospace';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(label, x + w / 2, y + 11);
  }

  function desenharAvatar(cx, baseY, cor, isHeroi, flash, nocauteado, auraFuria) {
    ctx.save();
    if (nocauteado) {
      ctx.translate(cx, baseY);
      ctx.rotate(isHeroi ? -Math.PI / 2.3 : Math.PI / 2.3);
      ctx.translate(-cx, -baseY);
    }

    // Sombra
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(cx, baseY, 38, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    // Aura
    if (auraFuria && !nocauteado) {
      const pulso = Math.sin(tempo * 3) * 8;
      ctx.fillStyle = 'rgba(250, 204, 21, 0.28)';
      ctx.beginPath();
      ctx.arc(cx, baseY - 64, 62 + pulso, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = isHeroi ? 'rgba(56, 189, 248, 0.16)' : 'rgba(244, 63, 94, 0.16)';
    ctx.beginPath();
    ctx.arc(cx, baseY - 64, 54, 0, Math.PI * 2);
    ctx.fill();

    const corpo = flash > 0.3 ? '#ffffff' : cor;
    const escuro = flash > 0.3 ? '#cbd5e1' : (isHeroi ? '#0e7490' : '#9f1239');

    if (isHeroi) {
      ctx.fillStyle = escuro;
      ctx.beginPath();
      ctx.moveTo(cx - 18, baseY - 76);
      ctx.lineTo(cx - 54 - Math.sin(tempo * 2) * 6, baseY - 16);
      ctx.lineTo(cx - 10, baseY - 22);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = escuro;
      ctx.beginPath();
      ctx.moveTo(cx - 44, baseY - 84);
      ctx.lineTo(cx, baseY - 72);
      ctx.lineTo(cx + 44, baseY - 84);
      ctx.lineTo(cx + 28, baseY - 56);
      ctx.lineTo(cx - 28, baseY - 56);
      ctx.closePath();
      ctx.fill();
    }

    // Pernas
    ctx.fillStyle = escuro;
    roundRect(cx - 20, baseY - 38, 15, 36, 7); ctx.fill();
    roundRect(cx + 5, baseY - 38, 15, 36, 7); ctx.fill();

    // Tronco
    ctx.fillStyle = corpo;
    roundRect(cx - 24, baseY - 82, 48, 50, 15); ctx.fill();

    // Emblema
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx, baseY - 60, 8, 0, Math.PI * 2);
    ctx.fill();

    // Cabeça
    ctx.fillStyle = corpo;
    ctx.beginPath();
    ctx.arc(cx, baseY - 101, 19, 0, Math.PI * 2);
    ctx.fill();

    // Visor
    ctx.fillStyle = isHeroi ? '#ffffff' : '#facc15';
    roundRect(isHeroi ? cx - 2 : cx - 16, baseY - 107, 18, 8, 4);
    ctx.fill();

    ctx.restore();
  }

  function loop() {
    animId = requestAnimationFrame(loop);
    if (!document.getElementById('screen-arena').classList.contains('active')) return;

    const w = canvas.clientWidth || 900;
    const h = canvas.clientHeight || 340;
    tempo += 0.08;

    if (match.heroi && match.vilao) {
      vidaExibidaHeroi += (match.heroi.vidaAtual - vidaExibidaHeroi) * 0.18;
      vidaExibidaVilao += (match.vilao.vidaAtual - vidaExibidaVilao) * 0.18;
      raivaExibidaHeroi += (match.heroi.raiva - raivaExibidaHeroi) * 0.2;
      poderExibidoHeroi += (match.heroi.nivelPoder - poderExibidoHeroi) * 0.2;
      raivaExibidaVilao += (match.vilao.raiva - raivaExibidaVilao) * 0.2;
      poderExibidoVilao += (match.vilao.nivelPoder - poderExibidoVilao) * 0.2;
    }

    dashHeroi = Math.max(0, dashHeroi - 0.065);
    dashVilao = Math.max(0, dashVilao - 0.065);
    flashHeroi = Math.max(0, flashHeroi - 0.06);
    flashVilao = Math.max(0, flashVilao - 0.06);
    screenShake = Math.max(0, screenShake - 1.1);

    ctx.save();
    if (screenShake > 0.2) {
      ctx.translate((Math.random() - 0.5) * screenShake, (Math.random() - 0.5) * screenShake);
    }

    // Fundo
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#0a0e1c');
    grad.addColorStop(1, '#18142c');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Holofotes
    ctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
    ctx.beginPath(); ctx.moveTo(w * 0.26, 0); ctx.lineTo(w * 0.12, h); ctx.lineTo(w * 0.40, h); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(244, 63, 94, 0.08)';
    ctx.beginPath(); ctx.moveTo(w * 0.74, 0); ctx.lineTo(w * 0.60, h); ctx.lineTo(w * 0.88, h); ctx.closePath(); ctx.fill();

    // Plataforma
    const pisoY = h * 0.84;
    ctx.fillStyle = '#1e2944';
    ctx.beginPath();
    ctx.ellipse(w * 0.5, pisoY, w * 0.4, 28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.45)';
    ctx.lineWidth = 2.2;
    ctx.stroke();

    if (match.heroi && match.vilao) {
      const hudW = Math.min(370, (w - 80) / 2);
      desenharHudLutador(match.heroi, 20, 10, hudW, vidaExibidaHeroi, raivaExibidaHeroi, poderExibidoHeroi, '#38bdf8');
      desenharHudLutador(match.vilao, w - hudW - 20, 10, hudW, vidaExibidaVilao, raivaExibidaVilao, poderExibidoVilao, '#f43f5e');

      const baseHeroiX = w * 0.26;
      const baseVilaoX = w * 0.74;
      const dist = baseVilaoX - baseHeroiX - 85;

      const xHeroi = baseHeroiX + Math.sin(dashHeroi * Math.PI) * dist - flashHeroi * 18;
      const xVilao = baseVilaoX - Math.sin(dashVilao * Math.PI) * dist + flashVilao * 18;

      const bobH = heroiNocauteado ? 18 : Math.sin(tempo) * 5;
      const bobV = vilaoNocauteado ? 18 : Math.cos(tempo) * 5;

      desenharAvatar(xHeroi, pisoY + bobH, '#38bdf8', true, flashHeroi, heroiNocauteado, raivaExibidaHeroi >= 80);
      desenharAvatar(xVilao, pisoY + bobV, '#f43f5e', false, flashVilao, vilaoNocauteado, raivaExibidaVilao >= 80);

      // Feixes
      if (dashHeroi > 0.35) {
        ctx.strokeStyle = golpeEspecialAtivo ? '#facc15' : '#38bdf8';
        ctx.lineWidth = golpeEspecialAtivo ? 18 : 11;
        ctx.beginPath(); ctx.moveTo(xHeroi + 25, pisoY - 55); ctx.lineTo(baseVilaoX, pisoY - 55); ctx.stroke();
      }
      if (dashVilao > 0.35) {
        ctx.strokeStyle = golpeEspecialAtivo ? '#a855f7' : '#f43f5e';
        ctx.lineWidth = golpeEspecialAtivo ? 18 : 11;
        ctx.beginPath(); ctx.moveTo(xVilao - 25, pisoY - 55); ctx.lineTo(baseHeroiX, pisoY - 55); ctx.stroke();
      }
    }

    // Ondas de choque
    ondas = ondas.filter(o => {
      o.raio += (o.raioMax - o.raio) * 0.16;
      o.vida -= 0.04;
      if (o.vida <= 0) return false;
      ctx.globalAlpha = Math.max(0, o.vida);
      ctx.strokeStyle = o.cor;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(o.x, o.y, o.raio, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      return true;
    });

    // Faíscas
    faiscas = faiscas.filter(f => {
      f.x += f.vx;
      f.y += f.vy;
      f.vy += 0.22;
      f.vida -= 0.032;
      if (f.vida <= 0) return false;
      ctx.globalAlpha = Math.max(0, f.vida);
      ctx.fillStyle = f.cor;
      ctx.beginPath();
      ctx.arc(f.x, f.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      return true;
    });

    // Textos flutuantes
    textos = textos.filter(t => {
      t.y -= 1.2;
      t.vida -= 0.02;
      if (t.vida <= 0) return false;
      ctx.globalAlpha = Math.max(0, t.vida);
      ctx.font = `bold ${t.size}px Segoe UI, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#000';
      ctx.fillText(t.texto, t.x + 2, t.y + 2);
      ctx.fillStyle = t.cor;
      ctx.fillText(t.texto, t.x, t.y);
      ctx.globalAlpha = 1;
      return true;
    });

    // Emotes Online
    emotes = emotes.filter(em => {
      em.y -= 0.8;
      em.vida -= 0.015;
      if (em.vida <= 0) return false;
      ctx.globalAlpha = Math.max(0, em.vida);
      ctx.fillStyle = 'rgba(11, 15, 25, 0.9)';
      roundRect(em.x - 65, em.y - 22, 130, 32, 12);
      ctx.fill();
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.font = 'bold 14px Segoe UI, sans-serif';
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.fillText(em.texto, em.x, em.y - 1);
      ctx.globalAlpha = 1;
      return true;
    });

    // Banner central
    if (bannerTexto) {
      const bw = Math.min(580, w - 48);
      const bh = 44;
      const bx = (w - bw) / 2;
      const by = h * 0.48 - 22;
      ctx.fillStyle = 'rgba(11, 15, 25, 0.92)';
      roundRect(bx, by, bw, bh, 14);
      ctx.fill();
      ctx.strokeStyle = bannerCor;
      ctx.lineWidth = 2.2;
      ctx.stroke();

      ctx.font = 'bold 15px Segoe UI, sans-serif';
      ctx.fillStyle = bannerCor;
      ctx.textAlign = 'center';
      ctx.fillText(bannerTexto, w / 2, by + 27);
    }

    ctx.restore();
  }

  loop();

  return { resetarRound, definirBanner, animarAtaque, mostrarEmote };
})();

// ==================== FLUXO DE RODADAS E TURNOS ====================
function limparTimers() {
  match.timers.forEach(t => clearTimeout(t));
  match.timers = [];
}

function agendar(ms, fn) {
  const id = setTimeout(fn, ms);
  match.timers.push(id);
}

function registrarLog(linha) {
  const log = document.getElementById('combat-log');
  const div = document.createElement('div');
  div.textContent = linha;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}

function atualizarPlacarArena() {
  document.getElementById('arena-round').textContent = `RODADA ${Math.max(1, match.rodadaAtual)} / 3`;
  const estH = (match.vitoriasHeroi >= 1 ? '★ ' : '☆ ') + (match.vitoriasHeroi >= 2 ? '★' : '☆');
  const estV = (match.vitoriasVilao >= 2 ? '★ ' : '☆ ') + (match.vitoriasVilao >= 1 ? '★' : '☆');
  document.getElementById('arena-score').textContent =
    `${match.heroi.nome.toUpperCase()} ${estH} ${match.vitoriasHeroi} x ${match.vitoriasVilao} ${estV} ${match.vilao.nome.toUpperCase()}`;
}

function iniciarSerieCombate() {
  limparTimers();
  match.rodadaAtual = 0;
  match.vitoriasHeroi = 0;
  match.vitoriasVilao = 0;
  match.vencedorAnterior = null;
  match.totalGolpes = 0;
  match.maiorDano = 0;
  match.autorMaiorDano = '-';
  match.aguardandoInput = false;
  match.aguardandoRemoto = false;

  const btnMode = document.getElementById('btn-mode');
  const emoteBar = document.getElementById('emote-bar');
  if (match.online) {
    match.modoManual = true;
    btnMode.textContent = match.role === 'HOST' ? '🌐 VOCÊ: HERÓI' : '🌐 VOCÊ: VILÃO';
    btnMode.disabled = true;
    emoteBar.classList.remove('hidden');
  } else {
    btnMode.disabled = false;
    btnMode.textContent = match.modoManual ? '🎮 MANUAL' : '🤖 AUTO';
    emoteBar.classList.add('hidden');
  }

  document.getElementById('combat-log').innerHTML = '';
  showScreen('screen-arena');
  iniciarProximaRodada();
}

function iniciarProximaRodada() {
  match.rodadaAtual++;
  match.heroi.vidaAtual = match.heroi.vidaMaxima;
  match.heroi.raiva = 0;
  match.heroi.nivelPoder = 20;

  match.vilao.vidaAtual = match.vilao.vidaMaxima;
  match.vilao.raiva = 0;
  match.vilao.nivelPoder = 20;

  ArenaEngine.resetarRound();
  atualizarPlacarArena();
  renderizarDeckGolpes(false);
  registrarLog(`================ RODADA ${match.rodadaAtual} ================`);

  if (match.online && match.role === 'GUEST') {
    ArenaEngine.definirBanner('AGUARDANDO SORTEIO DA RODADA...', '#facc15');
    return;
  }

  if (match.vencedorAnterior === null) {
    const sorteado = Math.random() < 0.5 ? 'HEROI' : 'VILAO';
    if (match.online && match.role === 'HOST') {
      enviarMensagemRede({ type: 'ROUND_INITIATIVE', iniciador: sorteado, comRoleta: true });
    }
    aplicarIniciativaRodada(sorteado, true);
  } else {
    const iniciador = match.vencedorAnterior;
    if (match.online && match.role === 'HOST') {
      enviarMensagemRede({ type: 'ROUND_INITIATIVE', iniciador, comRoleta: false });
    }
    aplicarIniciativaRodada(iniciador, false);
  }
}

function aplicarIniciativaRodada(iniciador, comRoleta) {
  const lutadorIni = iniciador === 'HEROI' ? match.heroi : match.vilao;
  const corIni = iniciador === 'HEROI' ? '#38bdf8' : '#f43f5e';

  if (!comRoleta) {
    ArenaEngine.definirBanner(`INICIATIVA: ${lutadorIni.nome.toUpperCase()} ATACA PRIMEIRO!`, '#facc15');
    registrarLog(`► ${lutadorIni.nome} venceu a rodada anterior e inicia atacando!`);
    agendar(match.rapido ? 600 : 1100, () => iniciarTurno(iniciador));
    return;
  }

  let passos = 0;
  const maxPassos = 12;
  function tickRoleta() {
    passos++;
    if (passos >= maxPassos) {
      ArenaEngine.definirBanner(`SORTEIO: ${lutadorIni.nome.toUpperCase()} COMEÇA!`, corIni);
      SoundFX.click();
      registrarLog(`► Sorteio de iniciativa: ${lutadorIni.nome} começa atacando!`);
      agendar(match.rapido ? 550 : 950, () => iniciarTurno(iniciador));
    } else {
      const showH = passos % 2 === 0;
      const atual = showH ? match.heroi : match.vilao;
      ArenaEngine.definirBanner(`SORTEANDO INICIATIVA: ${atual.nome.toUpperCase()}`, showH ? '#38bdf8' : '#f43f5e');
      SoundFX.roulette();
      agendar(match.rapido ? 45 : 80, tickRoleta);
    }
  }
  tickRoleta();
}

function iniciarTurno(lado) {
  match.turnoAtual = lado;

  // Define se o jogador local controla este turno
  const ehMeuTurnoLocal =
    (!match.online && lado === 'HEROI' && match.modoManual) ||
    (match.online && match.role === 'HOST' && lado === 'HEROI') ||
    (match.online && match.role === 'GUEST' && lado === 'VILAO');

  if (ehMeuTurnoLocal) {
    match.aguardandoInput = true;
    match.aguardandoRemoto = false;
    const cor = lado === 'HEROI' ? '#38bdf8' : '#f43f5e';
    ArenaEngine.definirBanner('SUA VEZ! ESCOLHA UM GOLPE ABAIXO', cor);
    renderizarDeckGolpes(true);
  } else {
    match.aguardandoInput = false;
    renderizarDeckGolpes(false);

    if (match.online) {
      if (match.role === 'HOST' && lado === 'VILAO') {
        match.aguardandoRemoto = true;
      }
      const oponente = lado === 'HEROI' ? match.heroi : match.vilao;
      ArenaEngine.definirBanner(`AGUARDANDO GOLPE DE ${oponente.nome.toUpperCase()}...`, '#facc15');
    } else {
      executarTurnoIA(lado);
    }
  }
}

function executarTurnoIA(lado) {
  const atacante = lado === 'HEROI' ? match.heroi : match.vilao;
  const golpe = escolherMelhorGolpeIA(atacante);
  const idx = atacante.golpes.indexOf(golpe);
  const cor = lado === 'HEROI' ? '#38bdf8' : '#f43f5e';
  ArenaEngine.definirBanner(`${atacante.nome.toUpperCase()} PREPARA: ${golpe.nome.toUpperCase()}...`, cor);
  agendar(match.rapido ? 420 : 820, () => resolverGolpeAutoritativo(lado, idx, golpe));
}

function resolverGolpeAutoritativo(lado, moveIndex, golpeEscolhido) {
  const atacante = lado === 'HEROI' ? match.heroi : match.vilao;
  const alvo = lado === 'HEROI' ? match.vilao : match.heroi;
  const golpe = podeUsarGolpe(atacante, golpeEscolhido) ? golpeEscolhido : atacante.golpes[0];

  // Atualiza recursos do atacante
  atacante.raiva = Math.max(0, Math.min(100, atacante.raiva - golpe.custoRaiva + golpe.ganhoRaiva));
  atacante.nivelPoder = Math.max(0, Math.min(100, atacante.nivelPoder - golpe.custoPoder + golpe.ganhoPoder));

  // Sorteio aleatório 80%, 100% ou 110%
  const percentuais = [80, 100, 110];
  const percentual = percentuais[Math.floor(Math.random() * percentuais.length)];

  const atkEfetivo = Math.round(atacante.ataque * golpe.mult * (percentual / 100));
  const dano = Math.max(1, atkEfetivo - alvo.defesa);

  alvo.vidaAtual = Math.max(0, alvo.vidaAtual - dano);
  alvo.raiva = Math.min(100, alvo.raiva + Math.max(15, Math.round(dano * 0.75)));
  alvo.nivelPoder = Math.min(100, alvo.nivelPoder + 10);

  const payload = {
    type: 'APPLY_STRIKE',
    lado,
    moveIndex,
    nomeGolpe: golpe.nome,
    mult: golpe.mult,
    percentual,
    dano,
    alvoVida: alvo.vidaAtual,
    alvoRaiva: alvo.raiva,
    alvoPoder: alvo.nivelPoder,
    atacanteRaiva: atacante.raiva,
    atacantePoder: atacante.nivelPoder
  };

  if (match.online && match.role === 'HOST') {
    enviarMensagemRede(payload);
  }

  aplicarResultadoGolpeSincronizado(payload);
}

function aplicarResultadoGolpeSincronizado(ev) {
  ArenaEngine.definirBanner('');

  const isHeroi = ev.lado === 'HEROI';
  const atacante = isHeroi ? match.heroi : match.vilao;
  const alvo = isHeroi ? match.vilao : match.heroi;

  atacante.raiva = ev.atacanteRaiva;
  atacante.nivelPoder = ev.atacantePoder;
  alvo.vidaAtual = ev.alvoVida;
  alvo.raiva = ev.alvoRaiva;
  alvo.nivelPoder = ev.alvoPoder;

  match.totalGolpes++;
  if (ev.dano > match.maiorDano) {
    match.maiorDano = ev.dano;
    match.autorMaiorDano = `${atacante.nome} (${ev.nomeGolpe})`;
  }

  ArenaEngine.animarAtaque(isHeroi, ev.nomeGolpe, ev.mult, ev.dano, alvo.vidaAtual, ev.percentual);

  if (alvo.vidaAtual === 0) {
    SoundFX.ko();
    ArenaEngine.definirBanner(`💥 K.O.! ${alvo.nome.toUpperCase()} FOI DESTRUÍDO!`, '#f43f5e');
  } else if (ev.dano === 1) {
    SoundFX.block();
  } else {
    SoundFX.hit(ev.mult >= 1.7 || ev.percentual === 110);
  }

  const descInt = ev.percentual === 80 ? 'Golpe Fraco • 80% ATK'
    : (ev.percentual === 110 ? 'Golpe Crítico • 110% ATK' : 'Golpe Normal • 100% ATK');

  registrarLog(
    `⚔ ${atacante.nome} usou [${ev.nomeGolpe} • ${ev.mult.toFixed(2)}x] (${descInt}) → Dano: ${ev.dano} | ${alvo.nome}: ${alvo.vidaAtual} HP`
  );

  renderizarDeckGolpes(false);

  if (alvo.vidaAtual === 0) {
    agendar(match.rapido ? 650 : 1200, () => finalizarRodada(ev.lado));
  } else {
    const proximoLado = isHeroi ? 'VILAO' : 'HEROI';
    agendar(match.rapido ? 520 : 1000, () => iniciarTurno(proximoLado));
  }
}

function finalizarRodada(ladoVencedor) {
  if (ladoVencedor === 'HEROI') match.vitoriasHeroi++;
  else match.vitoriasVilao++;

  match.vencedorAnterior = ladoVencedor;
  atualizarPlacarArena();

  const vencedor = ladoVencedor === 'HEROI' ? match.heroi : match.vilao;
  const cor = ladoVencedor === 'HEROI' ? '#38bdf8' : '#f43f5e';
  ArenaEngine.definirBanner(`🏆 VENCEDOR DA RODADA ${match.rodadaAtual}: ${vencedor.nome.toUpperCase()}`, cor);
  registrarLog(`★ Vencedor da Rodada ${match.rodadaAtual}: ${vencedor.nome}!`);

  agendar(match.rapido ? 900 : 1700, () => {
    if (match.rodadaAtual < 3 && match.vitoriasHeroi < 2 && match.vitoriasVilao < 2) {
      iniciarProximaRodada();
    } else {
      exibirTelaVitoria();
    }
  });
}

// ==================== PAINEL INTERATIVO DE GOLPES ====================
function renderizarDeckGolpes(meuTurnoAtivo) {
  const grid = document.getElementById('moves-grid');
  const instr = document.getElementById('moves-instruction');

  // Mostra os golpes do lutador controlado pelo jogador local
  const meuLutador = (match.online && match.role === 'GUEST') ? match.vilao : match.heroi;
  const oponente = (match.online && match.role === 'GUEST') ? match.heroi : match.vilao;
  if (!meuLutador) return;

  if (!match.online && !match.modoManual) {
    instr.textContent = "MODO AUTOMÁTICO ATIVO — CLIQUE EM '🤖 AUTO' PARA ASSUMIR O CONTROLE";
    instr.style.color = '#38bdf8';
  } else if (meuTurnoAtivo) {
    instr.textContent = `★ SUA VEZ! CLIQUE EM UM GOLPE DESBLOQUEADO PARA ATACAR ${oponente.nome.toUpperCase()}:`;
    instr.style.color = '#facc15';
  } else {
    instr.textContent = 'AGUARDANDO MOVIMENTO DO ADVERSÁRIO...';
    instr.style.color = '#94a3b8';
  }

  const icones = ['⚔ ', '⚡ ', '🔥 ', '💥 '];
  grid.innerHTML = '';

  meuLutador.golpes.forEach((g, idx) => {
    const desbloqueado = podeUsarGolpe(meuLutador, g);
    const clicavel = meuTurnoAtivo && desbloqueado;

    let condTexto = `Gera +${g.ganhoRaiva} Raiva | +${g.ganhoPoder} Poder`;
    if (g.minRaiva > 0 && g.minPoder > 0) condTexto = `Req: ${g.minRaiva} Raiva + ${g.minPoder} Poder`;
    else if (g.minRaiva > 0) condTexto = `Req: ${g.minRaiva} Raiva (consome ${g.custoRaiva})`;
    else if (g.minPoder > 0) condTexto = `Req: ${g.minPoder} Poder (consome ${g.custoPoder})`;

    const btn = document.createElement('button');
    btn.className = `move-btn tier-${idx} ${desbloqueado ? 'unlocked' : ''} ${clicavel ? 'active-turn' : ''}`;
    btn.disabled = !clicavel;
    btn.innerHTML = `
      <div class="move-top">
        <span>${icones[idx]}${g.nome}</span>
        <span class="mono text-gold">${g.mult.toFixed(2)}x</span>
      </div>
      <div class="move-cond">${condTexto}</div>
      <div class="move-status" style="color:${clicavel ? '#22c55e' : (desbloqueado ? '#38bdf8' : '#f43f5e')}">
        ${clicavel ? '✔ CLIQUE PARA USAR AGORA' : (desbloqueado ? '● Desbloqueado' : '🔒 Condição pendente')}
      </div>
    `;

    btn.addEventListener('click', () => {
      if (!clicavel || !match.aguardandoInput) return;
      match.aguardandoInput = false;
      SoundFX.click();
      renderizarDeckGolpes(false);

      if (match.online && match.role === 'GUEST') {
        ArenaEngine.definirBanner('GOLPE ENVIADO! EXECUTANDO...', '#f43f5e');
        enviarMensagemRede({ type: 'REQUEST_MOVE', moveIndex: idx });
      } else {
        resolverGolpeAutoritativo('HEROI', idx, g);
      }
    });

    grid.appendChild(btn);
  });
}

// Controles da Barra Superior da Arena
document.getElementById('btn-mode').addEventListener('click', () => {
  if (match.online) return;
  match.modoManual = !match.modoManual;
  document.getElementById('btn-mode').textContent = match.modoManual ? '🎮 MANUAL' : '🤖 AUTO';
  SoundFX.click();
  if (!match.modoManual && match.aguardandoInput && match.turnoAtual === 'HEROI') {
    match.aguardandoInput = false;
    renderizarDeckGolpes(false);
    executarTurnoIA('HEROI');
  }
});

document.getElementById('btn-speed').addEventListener('click', () => {
  match.rapido = !match.rapido;
  document.getElementById('btn-speed').textContent = match.rapido ? '⏩ 2x' : '⏩ 1x';
  SoundFX.click();
});

document.getElementById('btn-sound').addEventListener('click', () => {
  const mutado = SoundFX.toggleMute();
  document.getElementById('btn-sound').textContent = mutado ? '🔇' : '🔊';
});

document.getElementById('btn-leave-arena').addEventListener('click', () => {
  SoundFX.click();
  limparTimers();
  if (match.online) encerrarConexaoOnline();
  showScreen('screen-home');
});

document.querySelectorAll('.emote-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const txt = btn.dataset.emote;
    const isHero = match.role === 'HOST';
    ArenaEngine.mostrarEmote(isHero, txt);
    SoundFX.click();
    enviarMensagemRede({ type: 'EMOTE', from: isHero ? 'HEROI' : 'VILAO', text: txt });
  });
});

// ==================== TELA VITÓRIA & CONFETES ====================
function exibirTelaVitoria() {
  const heroiVenceu = match.vitoriasHeroi > match.vitoriasVilao;
  const campeao = heroiVenceu ? match.heroi : match.vilao;

  const vicCat = document.getElementById('vic-category');
  vicCat.textContent = `★ ${campeao.categoria.toUpperCase()} ★`;
  vicCat.className = `victory-cat ${heroiVenceu ? 'text-hero' : 'text-villain'}`;

  document.getElementById('vic-name').textContent = campeao.nome.toUpperCase();
  document.getElementById('vic-score').textContent =
    `Placar Final: ${match.heroi.nome} ${match.vitoriasHeroi} x ${match.vitoriasVilao} ${match.vilao.nome}`;

  document.getElementById('vic-stats').innerHTML = `
    Total de golpes desferidos na série: <strong>${match.totalGolpes}</strong><br/>
    Golpe mais devastador: <strong>${match.maiorDano} de dano</strong> (por ${match.autorMaiorDano})
  `;

  const btnRematch = document.getElementById('btn-rematch');
  const btnNew = document.getElementById('btn-new-battle');
  if (match.online) {
    btnNew.classList.add('hidden');
    btnRematch.disabled = match.role === 'GUEST';
    btnRematch.textContent = match.role === 'HOST' ? '🔄  REVANCHE ONLINE' : '⏳ AGUARDANDO ANFITRIÃO';
  } else {
    btnNew.classList.remove('hidden');
    btnRematch.disabled = false;
    btnRematch.textContent = '🔄  REVANCHE IMEDIATA';
  }

  SoundFX.victory();
  showScreen('screen-victory');
  iniciarConfetes();
}

document.getElementById('btn-rematch').addEventListener('click', () => {
  SoundFX.click();
  if (match.online && match.role === 'HOST') {
    enviarMensagemRede({ type: 'REMATCH' });
  }
  iniciarSerieCombate();
});

document.getElementById('btn-new-battle').addEventListener('click', () => {
  SoundFX.click();
  showScreen('screen-select');
});

document.getElementById('btn-vic-home').addEventListener('click', () => {
  SoundFX.click();
  if (match.online) encerrarConexaoOnline();
  showScreen('screen-home');
});

// ==================== ANIMAÇÕES DE FUNDO (HOME & CONFETES) ====================
function iniciarParticulasHome() {
  const canvas = document.getElementById('home-bg-canvas');
  const ctx = canvas.getContext('2d');
  const cores = ['#38bdf8', '#f43f5e', '#facc15'];
  const pts = Array.from({ length: 65 }, () => ({
    x: Math.random() * 1400,
    y: Math.random() * 900,
    r: 1.5 + Math.random() * 2.8,
    vy: 0.35 + Math.random() * 1.1,
    cor: cores[Math.floor(Math.random() * cores.length)]
  }));

  function frame() {
    requestAnimationFrame(frame);
    if (!document.getElementById('screen-home').classList.contains('active')) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, '#090d18');
    grad.addColorStop(1, '#16122a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
    ctx.beginPath(); ctx.arc(120, 120, 260, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(244, 63, 94, 0.08)';
    ctx.beginPath(); ctx.arc(canvas.width - 120, canvas.height - 120, 260, 0, Math.PI * 2); ctx.fill();

    pts.forEach(p => {
      p.y -= p.vy;
      if (p.y < -10) { p.y = canvas.height + 10; p.x = Math.random() * canvas.width; }
      ctx.fillStyle = p.cor;
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }
  frame();
}

function iniciarConfetes() {
  const canvas = document.getElementById('confetti-canvas');
  const ctx = canvas.getContext('2d');
  const paleta = ['#facc15', '#38bdf8', '#f43f5e', '#22c55e', '#a855f7'];
  const pecas = Array.from({ length: 95 }, () => ({
    x: Math.random() * window.innerWidth,
    y: -Math.random() * window.innerHeight,
    vy: 2 + Math.random() * 3.5,
    cor: paleta[Math.floor(Math.random() * paleta.length)]
  }));

  function frame() {
    if (!document.getElementById('screen-victory').classList.contains('active')) return;
    requestAnimationFrame(frame);
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    pecas.forEach(c => {
      c.y += c.vy;
      c.x += Math.sin(c.y * 0.03) * 1.4;
      if (c.y > canvas.height + 15) { c.y = -15; c.x = Math.random() * canvas.width; }
      ctx.fillStyle = c.cor;
      ctx.fillRect(c.x, c.y, 10, 6);
    });
  }
  frame();
}

// ==================== INICIALIZAÇÃO ====================
document.getElementById('btn-go-online').addEventListener('click', () => { SoundFX.click(); showScreen('screen-online'); });
document.getElementById('btn-go-select').addEventListener('click', () => { SoundFX.click(); showScreen('screen-select'); });
document.getElementById('btn-go-register').addEventListener('click', () => { SoundFX.click(); showScreen('screen-register'); });
document.getElementById('btn-go-roster').addEventListener('click', () => { SoundFX.click(); showScreen('screen-roster'); });

iniciarParticulasHome();
atualizarContadorHome();
atualizarPreviewCadastro();

// Suporte a link direto com ?sala=XXXX
const params = new URLSearchParams(window.location.search);
const salaConvite = params.get('sala');
if (salaConvite) {
  document.getElementById('guest-room-input').value = salaConvite;
  showScreen('screen-online');
}
