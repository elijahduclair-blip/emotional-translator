window.EMOTIONAL_TRANSLATOR_CONFIG = Object.freeze({
  API_BASE_URL: ['localhost', '127.0.0.1'].includes(window.location.hostname)
    ? 'http://localhost:3000/api'
    : 'https://eli-emotional-translator-api.onrender.com/api'
});
