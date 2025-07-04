export default {
  async fetch(request, env, ctx) {
    return new Response('Newsletter Worker is running!', {
      headers: { 'content-type': 'text/plain' },
    });
  },
}; 