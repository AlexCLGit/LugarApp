(() => {
  'use strict';
  const config = { webhookUrl: '', timeoutMs: 20000, maxHistoryMessages: 20, ...window.LUGAR_CONFIG };
  const $ = (selector) => document.querySelector(selector);
  const parks = [
    { city: 'Lisboa', name: 'Lugar Saldanha', area: 'Avenidas Novas · Coberto' },
    { city: 'Porto', name: 'Lugar Boavista', area: 'Boavista · Coberto' },
    { city: 'Braga', name: 'Lugar Centro', area: 'Centro · Coberto' },
    { city: 'Coimbra', name: 'Lugar Mondego', area: 'Baixa · Coberto' },
    { city: 'Faro', name: 'Lugar Marina', area: 'Centro · Exterior' },
    { city: 'Funchal', name: 'Lugar Lido', area: 'Lido · Coberto' }
  ];
  let context = { plan: null, city: null, park: null };
  let history = [];
  let busy = false;
  let previousFocus = null;
  const randomId = () => window.crypto?.randomUUID?.() || `lugar-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let sessionId = randomId();
  try {
    sessionId = sessionStorage.getItem('lugar-session') || sessionId;
    sessionStorage.setItem('lugar-session', sessionId);
  } catch { /* O chat também funciona com armazenamento bloqueado. */ }

  $('#year').textContent = new Date().getFullYear();
  const menuButton = $('.menu-toggle');
  function closeMenu() {
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', 'Abrir menu');
    $('#main-nav').classList.remove('is-open');
  }
  menuButton.addEventListener('click', () => {
    const open = menuButton.getAttribute('aria-expanded') !== 'true';
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    $('#main-nav').classList.toggle('is-open', open);
  });
  $('#main-nav').querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));

  function renderParks() {
    const city = $('#city').value;
    const filtered = parks.filter(park => city === 'all' || park.city === city);
    $('#park-count').textContent = `${filtered.length} ${filtered.length === 1 ? 'parque de demonstração' : 'parques de demonstração'}`;
    $('#park-list').replaceChildren(...filtered.map(park => {
      const row = document.createElement('article');
      row.className = 'park-item';
      const icon = document.createElement('span');
      icon.className = 'park-p'; icon.textContent = 'P'; icon.setAttribute('aria-hidden', 'true');
      const info = document.createElement('div'); info.className = 'park-info';
      const title = document.createElement('h3'); title.textContent = `${park.name} · ${park.city}`;
      const description = document.createElement('p'); description.textContent = park.area;
      info.append(title, description);
      const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Saber mais';
      button.setAttribute('aria-label', `Saber mais sobre ${park.name} em ${park.city}`);
      button.addEventListener('click', () => {
        context = { ...context, city: park.city, park: park.name };
        openChat(); sendMessage(`Quero saber mais sobre o ${park.name}, em ${park.city}.`);
      });
      row.append(icon, info, button); return row;
    }));
  }
  $('#city').addEventListener('change', () => {
    context.city = $('#city').value === 'all' ? null : $('#city').value;
    context.park = null; renderParks();
  });
  renderParks();

  const chat = $('#support-chat');
  const input = $('#chat-input');
  const messages = $('#chat-messages');
  const launcher = $('#chat-launcher');
  const connected = Boolean(config.webhookUrl.trim());
  if (connected) {
    $('#chat-mode').textContent = 'Assistente virtual';
    $('#chat-footnote').textContent = 'Mensagens enviadas ao suporte · Não partilhes dados sensíveis.';
  }
  function addMessage(role, text, error = false) {
    const bubble = document.createElement('div');
    bubble.className = `message ${role}${error ? ' error' : ''}`;
    // Conteúdo de utilizador e webhook tratado como texto, nunca como HTML.
    bubble.textContent = text;
    messages.append(bubble); messages.scrollTop = messages.scrollHeight;
    return bubble;
  }
  addMessage('assistant', 'Olá! 👋 Bem-vindo à Lugar. Posso ajudar-te a escolher um plano ou a encontrar um parque. Por onde começamos?');
  function openChat() {
    if (chat.hidden) previousFocus = document.activeElement;
    chat.hidden = false; launcher.setAttribute('aria-expanded', 'true');
    input.focus({ preventScroll: true });
  }
  function closeChat() {
    chat.hidden = true; launcher.setAttribute('aria-expanded', 'false');
    (previousFocus || launcher).focus({ preventScroll: true });
  }
  document.querySelectorAll('[data-chat]').forEach(button => button.addEventListener('click', openChat));
  launcher.addEventListener('click', () => chat.hidden ? openChat() : closeChat());
  $('#chat-close').addEventListener('click', closeChat);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') { if (!chat.hidden) closeChat(); closeMenu(); }
  });
  document.querySelectorAll('[data-plan]').forEach(button => button.addEventListener('click', () => {
    if (busy) { openChat(); return; }
    context.plan = button.dataset.plan;
    openChat(); sendMessage(`Tenho interesse no plano ${context.plan}. Como funciona?`);
  }));
  document.querySelectorAll('[data-question]').forEach(button => button.addEventListener('click', () => sendMessage(button.dataset.question)));

  function demoReply(message) {
    const text = message.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (/cancel|fideliza/.test(text)) return 'O mensal não tem fidelização: cancela antes da próxima renovação. O anual é um pagamento único de 890 € por 12 meses, sem renovação automática. Nesta demonstração não existem subscrições reais para cancelar.';
    const selected = { 'Diário': '6 € por 24 horas', 'Semanal': '29 € por 7 dias consecutivos', 'Mensal': '89 € por mês, sem fidelização', 'Anual': '890 € por 12 meses (equivalente a 74,17 €/mês)' };
    if (/tenho interesse no plano/.test(text) && context.plan) return `O plano ${context.plan} custa ${selected[context.plan]}. Inclui entradas e saídas ilimitadas, com acesso 24 horas ao parque escolhido. Em que cidade gostarias de estacionar? Esta é uma simulação; não será feita qualquer reserva ou cobrança.`;
    const park = parks.find(p => text.includes(p.name.toLowerCase()));
    if (park) return `${park.name}, em ${park.city}: parque ${park.area.toLowerCase()}, com acesso 24 horas. Planos desde 6 €/dia ou 89 €/mês. Esta localização é ilustrativa. Queres saber mais sobre algum plano?`;
    const cityPark = parks.find(p => text.includes(p.city.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()));
    if (cityPark) { context.city = cityPark.city; context.park = cityPark.name; return `Em ${cityPark.city}, temos o ${cityPark.name} (${cityPark.area}). Podes escolher entre diário (6 €), semanal (29 €), mensal (89 €) e anual (890 €). O parque é fictício e serve apenas para este exercício.`; }
    if (/parque|cidade|onde|localiza/.test(text)) return 'Podes explorar os nossos parques de demonstração em Lisboa, Porto, Braga, Coimbra, Faro e Funchal. Cada plano está associado a um parque. Em que cidade procuras lugar?';
    if (/preco|plano|custa|diario|semanal|mensal|anual/.test(text)) return 'Temos quatro planos: Diário — 6 €/dia; Semanal — 29 €/semana; Mensal — 89 €/mês; Anual — 890 €/ano. Todos incluem acesso 24 horas e entradas e saídas ilimitadas num parque escolhido. Preços fictícios, com IVA incluído.';
    if (/acesso|entrar|codigo|horario/.test(text)) return 'A proposta da Lugar inclui acesso 24 horas por código digital e entradas e saídas ilimitadas no parque escolhido. Nesta demonstração não são emitidos códigos de acesso.';
    if (/ola|bom dia|boa tarde|boa noite/.test(text)) return 'Olá! Vamos encontrar o teu lugar? Diz-me a cidade ou pergunta pelos nossos planos.';
    return 'Sou o assistente local de demonstração. Posso responder sobre planos, cidades, acesso e cancelamento. Experimenta perguntar «Quais são os planos?» ou «Têm parques no Porto?».';
  }

  async function requestReply(payload) {
    if (!connected) return demoReply(payload.message);
    const url = new URL(config.webhookUrl);
    if (!['https:', 'http:'].includes(url.protocol)) throw new Error('URL inválido');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs);
    try {
      const response = await fetch(url.href, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload), signal: controller.signal,
        credentials: 'omit', referrerPolicy: 'no-referrer'
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const reply = data.reply || data.output || data.message;
      if (typeof reply !== 'string' || !reply.trim()) throw new Error('Resposta sem texto');
      return reply;
    } finally { clearTimeout(timer); }
  }
  function setBusy(value) {
    busy = value;
    $('#chat-send').disabled = value;
    document.querySelectorAll('[data-question], [data-plan], .park-item button, .retry-button').forEach(button => button.disabled = value);
    $('#chat-status').textContent = value ? 'O assistente está a responder…' : '';
  }
  async function sendMessage(raw, retryPayload = null, retryBubble = null) {
    const text = raw.trim();
    if (!text || busy || text.length > 2000) return;
    if (!retryPayload) {
      addMessage('user', text);
      history.push({ role: 'user', content: text });
      input.value = '';
    }
    const payload = retryPayload || {
      sessionId, requestId: randomId(), message: text,
      history: history.slice(-config.maxHistoryMessages), context: { ...context },
      source: 'lugar-landing', locale: 'pt-PT', timestamp: new Date().toISOString()
    };
    setBusy(true);
    if (retryBubble) retryBubble.remove();
    try {
      const reply = await requestReply(payload);
      addMessage('assistant', reply);
      history.push({ role: 'assistant', content: reply });
      history = history.slice(-config.maxHistoryMessages);
    } catch {
      const bubble = addMessage('assistant', 'Não foi possível obter resposta do suporte. Tenta novamente dentro de instantes.', true);
      const retry = document.createElement('button'); retry.type = 'button'; retry.className = 'retry-button'; retry.textContent = 'Tentar novamente';
      // Mantém requestId para o backend poder evitar operações duplicadas.
      retry.addEventListener('click', () => sendMessage(text, payload, bubble));
      bubble.append(retry); messages.scrollTop = messages.scrollHeight;
    } finally { setBusy(false); }
  }
  $('#chat-form').addEventListener('submit', event => { event.preventDefault(); sendMessage(input.value); });
})();
