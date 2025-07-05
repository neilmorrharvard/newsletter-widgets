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

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Please check your email to confirm your subscription!' 
    }), {
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

// Lightweight MD5 implementation for Workers (from https://github.com/blueimp/JavaScript-MD5)
function md5cycle(x, k) {
  var a = x[0], b = x[1], c = x[2], d = x[3];
  a = ff(a, b, c, d, k[0], 7, -680876936);
  d = ff(d, a, b, c, k[1], 12, -389564586);
  c = ff(c, d, a, b, k[2], 17, 606105819);
  b = ff(b, c, d, a, k[3], 22, -1044525330);
  a = ff(a, b, c, d, k[4], 7, -176418897);
  d = ff(d, a, b, c, k[5], 12, 1200080426);
  c = ff(c, d, a, b, k[6], 17, -1473231341);
  b = ff(b, c, d, a, k[7], 22, -45705983);
  a = ff(a, b, c, d, k[8], 7, 1770035416);
  d = ff(d, a, b, c, k[9], 12, -1958414417);
  c = ff(c, d, a, b, k[10], 17, -42063);
  b = ff(b, c, d, a, k[11], 22, -1990404162);
  a = ff(a, b, c, d, k[12], 7, 1804603682);
  d = ff(d, a, b, c, k[13], 12, -40341101);
  c = ff(c, d, a, b, k[14], 17, -1502002290);
  b = ff(b, c, d, a, k[15], 22, 1236535329);
  a = gg(a, b, c, d, k[1], 5, -165796510);
  d = gg(d, a, b, c, k[6], 9, -1069501632);
  c = gg(c, d, a, b, k[11], 14, 643717713);
  b = gg(b, c, d, a, k[0], 20, -373897302);
  a = gg(a, b, c, d, k[5], 5, -701558691);
  d = gg(d, a, b, c, k[10], 9, 38016083);
  c = gg(c, d, a, b, k[15], 14, -660478335);
  b = gg(b, c, d, a, k[4], 20, -405537848);
  a = gg(a, b, c, d, k[9], 5, 568446438);
  d = gg(d, a, b, c, k[14], 9, -1019803690);
  c = gg(c, d, a, b, k[3], 14, -187363961);
  b = gg(b, c, d, a, k[8], 20, 1163531501);
  a = gg(a, b, c, d, k[13], 5, -1444681467);
  d = gg(d, a, b, c, k[2], 9, -51403784);
  c = gg(c, d, a, b, k[7], 14, 1735328473);
  b = gg(b, c, d, a, k[12], 20, -1926607734);
  a = hh(a, b, c, d, k[5], 4, -378558);
  d = hh(d, a, b, c, k[8], 11, -2022574463);
  c = hh(c, d, a, b, k[11], 16, 1839030562);
  b = hh(b, c, d, a, k[14], 23, -35309556);
  a = hh(a, b, c, d, k[1], 4, -1530992060);
  d = hh(d, a, b, c, k[4], 11, 1272893353);
  c = hh(c, d, a, b, k[7], 16, -155497632);
  b = hh(b, c, d, a, k[10], 23, -1094730640);
  a = hh(a, b, c, d, k[13], 4, 681279174);
  d = hh(d, a, b, c, k[0], 11, -358537222);
  c = hh(c, d, a, b, k[3], 16, -722521979);
  b = hh(b, c, d, a, k[6], 23, 76029189);
  a = hh(a, b, c, d, k[9], 4, -640364487);
  d = hh(d, a, b, c, k[12], 11, -421815835);
  c = hh(c, d, a, b, k[15], 16, 530742520);
  b = hh(b, c, d, a, k[2], 23, -995338651);
  a = ii(a, b, c, d, k[0], 6, -198630844);
  d = ii(d, a, b, c, k[7], 10, 1126891415);
  c = ii(c, d, a, b, k[14], 15, -1416354905);
  b = ii(b, c, d, a, k[5], 21, -57434055);
  a = ii(a, b, c, d, k[12], 6, 1700485571);
  d = ii(d, a, b, c, k[3], 10, -1894986606);
  c = ii(c, d, a, b, k[10], 15, -1051523);
  b = ii(b, c, d, a, k[1], 21, -2054922799);
  a = ii(a, b, c, d, k[8], 6, 1873313359);
  d = ii(d, a, b, c, k[15], 10, -30611744);
  c = ii(c, d, a, b, k[6], 15, -1560198380);
  b = ii(b, c, d, a, k[13], 21, 1309151649);
  a = ii(a, b, c, d, k[4], 6, -145523070);
  d = ii(d, a, b, c, k[11], 10, -1120210379);
  c = ii(c, d, a, b, k[2], 15, 718787259);
  b = ii(b, c, d, a, k[9], 21, -343485551);
  x[0] = add32(a, x[0]);
  x[1] = add32(b, x[1]);
  x[2] = add32(c, x[2]);
  x[3] = add32(d, x[3]);
}
function cmn(q, a, b, x, s, t) {
  a = add32(add32(a, q), add32(x, t));
  return add32((a << s) | (a >>> (32 - s)), b);
}
function ff(a, b, c, d, x, s, t) {
  return cmn((b & c) | (~b & d), a, b, x, s, t);
}
function gg(a, b, c, d, x, s, t) {
  return cmn((b & d) | (c & ~d), a, b, x, s, t);
}
function hh(a, b, c, d, x, s, t) {
  return cmn(b ^ c ^ d, a, b, x, s, t);
}
function ii(a, b, c, d, x, s, t) {
  return cmn(c ^ (b | ~d), a, b, x, s, t);
}
function md51(s) {
  var txt = '';
  var n = s.length,
    state = [1732584193, -271733879, -1732584194, 271733878],
    i;
  for (i = 64; i <= n; i += 64) {
    md5cycle(state, md5blk(s.substring(i - 64, i)));
  }
  s = s.substring(i - 64);
  var tail = Array(16).fill(0);
  for (i = 0; i < s.length; i++) tail[i >> 2] |= s.charCodeAt(i) << ((i % 4) << 3);
  tail[i >> 2] |= 0x80 << ((i % 4) << 3);
  if (i > 55) {
    md5cycle(state, tail);
    tail = Array(16).fill(0);
  }
  tail[14] = n * 8;
  md5cycle(state, tail);
  return state;
}
function md5blk(s) {
  var md5blks = [], i;
  for (i = 0; i < 64; i += 4) {
    md5blks[i >> 2] =
      s.charCodeAt(i) +
      (s.charCodeAt(i + 1) << 8) +
      (s.charCodeAt(i + 2) << 16) +
      (s.charCodeAt(i + 3) << 24);
  }
  return md5blks;
}
function rhex(n) {
  var s = '', j = 0;
  for (; j < 4; j++) s += ((n >> (j * 8 + 4)) & 0x0f).toString(16) + ((n >> (j * 8)) & 0x0f).toString(16);
  return s;
}
function hex(x) {
  for (var i = 0; i < x.length; i++) x[i] = rhex(x[i]);
  return x.join('');
}
function md5(s) {
  return hex(md51(s));
}
function add32(a, b) {
  return (a + b) & 0xffffffff;
}

async function subscribeToMailchimp(email, env) {
  const apiKey = env.MAILCHIMP_API_KEY;
  const audienceId = env.MAILCHIMP_AUDIENCE_ID;
  const serverPrefix = env.MAILCHIMP_SERVER_PREFIX; // e.g. 'us21'
  if (!apiKey || !audienceId || !serverPrefix) {
    return { success: false, error: 'Mailchimp environment variables not set' };
  }
  const subscriberHash = md5(email.toLowerCase());
  const url = `https://${serverPrefix}.api.mailchimp.com/3.0/lists/${audienceId}/members/${subscriberHash}`;
  const body = JSON.stringify({
    email_address: email,
    status: 'pending',
    source: 'Newsletter Widget',
    interests: {
      "960b22790b": true
    }
  });
  const auth = 'Basic ' + btoa('anystring:' + apiKey);
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': auth,
      'Content-Type': 'application/json',
    },
    body,
  });
  
  if (res.status === 200 || res.status === 201) {
    // Add a note to the subscriber's profile
    const noteUrl = `https://${serverPrefix}.api.mailchimp.com/3.0/lists/${audienceId}/members/${subscriberHash}/notes`;
    const noteBody = JSON.stringify({
      note: `Resubscribed via newsletter widget on ${new Date().toISOString().slice(0, 10)}`
    });
    
    try {
      await fetch(noteUrl, {
        method: 'POST',
        headers: {
          'Authorization': auth,
          'Content-Type': 'application/json',
        },
        body: noteBody,
      });
    } catch (noteErr) {
      // Don't fail the subscription if adding the note fails
      console.log('Failed to add note:', noteErr);
    }
    
    return { success: true };
  } else {
    const err = await res.json().catch(() => ({}));
    return { success: false, error: err.detail || 'Mailchimp error' };
  }
} 