// Ponto de ligação ao n8n. Vazio = respostas locais de demonstração.
// Webhook de produção: cada pergunta é enviada por POST em JSON.
// Esta configuração é pública: nunca colocar tokens ou segredos aqui.
window.LUGAR_CONFIG = Object.freeze({
  webhookUrl: "https://alexcl.app.n8n.cloud/webhook/lugarapp",
  timeoutMs: 20000,
  maxHistoryMessages: 20
});
