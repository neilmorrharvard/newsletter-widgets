const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env, ctx) {
    // Handle preflight OPTIONS
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
        status: 405,
        headers: { 'content-type': 'application/json', ...corsHeaders },
      });
    }

    // Parse JSON body
    let data;
    try {
      data = await request.json();
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400,
        headers: { 'content-type': 'application/json', ...corsHeaders },
      });
    }

    const email = (data.email || '').toLowerCase().trim();
    const turnstileToken = data.turnstile_token;
    if (!validateEmail(email)) {
      return new Response(JSON.stringify({ error: 'Invalid email address' }), {
        status: 400,
        headers: { 'content-type': 'application/json', ...corsHeaders },
      });
    }
    if (!turnstileToken) {
      return new Response(JSON.stringify({ error: 'CAPTCHA required' }), {
        status: 400,
        headers: { 'content-type': 'application/json', ...corsHeaders },
      });
    }

    // Verify Turnstile token
    const turnstileSecret = env.TURNSTILE_SECRET;
    const turnstileRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: `secret=${encodeURIComponent(turnstileSecret)}&response=${encodeURIComponent(turnstileToken)}`,
    });
    const turnstileData = await turnstileRes.json();
    if (!turnstileData.success) {
      return new Response(JSON.stringify({ error: 'CAPTCHA verification failed' }), {
        status: 400,
        headers: { 'content-type': 'application/json', ...corsHeaders },
      });
    }

    // Rate limit by IP (100 per day)
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const kvKey = `rate:${ip}:${getToday()}`;
    let count = 0;
    if (env.RATE_LIMIT_KV) {
      const stored = await env.RATE_LIMIT_KV.get(kvKey);
      count = stored ? parseInt(stored, 10) : 0;
      if (count >= 100) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
          status: 429,
          headers: { 'content-type': 'application/json', ...corsHeaders },
        });
      }
      await env.RATE_LIMIT_KV.put(kvKey, (count + 1).toString(), { expirationTtl: 86400 });
    }

    // Subscribe to Mailchimp
    const mcRes = await subscribeToMailchimp(email, env);
    if (!mcRes.success) {
      return new Response(JSON.stringify({ error: mcRes.error }), {
        status: 500,
        headers: { 'content-type': 'application/json', ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'content-type': 'application/json', ...corsHeaders },
    });
  },
};

function validateEmail(email) {
  // Simple email regex
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

function getToday() {
  // Returns YYYY-MM-DD
  return new Date().toISOString().slice(0, 10);
}

async function subscribeToMailchimp(email, env) {
  const apiKey = env.MAILCHIMP_API_KEY;
  const audienceId = env.MAILCHIMP_AUDIENCE_ID;
  const serverPrefix = env.MAILCHIMP_SERVER_PREFIX; // e.g. 'us21'
  if (!apiKey || !audienceId || !serverPrefix) {
    return { success: false, error: 'Mailchimp environment variables not set' };
  }
  const url = `https://${serverPrefix}.api.mailchimp.com/3.0/lists/${audienceId}/members`;
  const body = JSON.stringify({
    email_address: email,
    status: 'subscribed',
    interests: {
      "75cf611eb5": true
    }
  });
  const auth = 'Basic ' + btoa('anystring:' + apiKey);
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': auth,
      'Content-Type': 'application/json',
    },
    body,
  });
  if (res.status === 200 || res.status === 201) {
    return { success: true };
  } else {
    const err = await res.json().catch(() => ({}));
    return { success: false, error: err.detail || 'Mailchimp error' };
  }
} 