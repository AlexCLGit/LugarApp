// Ponto de ligação ao n8n. Vazio = respostas locais de demonstração.
// Exemplo: webhookUrl: "https://o-teu-n8n.exemplo/webhook/lugar-suporte"
// Esta configuração é pública: nunca colocar tokens ou segredos aqui.
window.LUGAR_CONFIG = Object.freeze({
  webhookUrl: "",
  timeoutMs: 20000,
  maxHistoryMessages: 20
});
