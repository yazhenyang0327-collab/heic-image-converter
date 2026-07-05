'use strict';

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const DEFAULT_HOSTNAMES = [
  'heicimageconverter.com',
  'www.heicimageconverter.com',
  'heic-tau.vercel.app'
];

module.exports = async function verifyTurnstile(request, response) {
  response.setHeader('Cache-Control', 'no-store');

  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ success: false, error: 'method_not_allowed' });
  }

  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.error('TURNSTILE_SECRET_KEY is not configured');
    return response.status(500).json({ success: false, error: 'verification_unavailable' });
  }

  let body = request.body || {};
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return response.status(400).json({ success: false, error: 'invalid_request' });
    }
  }

  const token = typeof body.token === 'string' ? body.token.trim() : '';
  if (!token || token.length > 4096) {
    return response.status(400).json({ success: false, error: 'missing_token' });
  }

  const forwardedFor = request.headers['x-forwarded-for'];
  const remoteIp = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : String(forwardedFor || '').split(',')[0].trim();

  const form = new URLSearchParams({
    secret,
    response: token
  });
  if (remoteIp) form.set('remoteip', remoteIp);

  try {
    const cloudflareResponse = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
      signal: AbortSignal.timeout(8000)
    });

    if (!cloudflareResponse.ok) {
      throw new Error(`Cloudflare returned ${cloudflareResponse.status}`);
    }

    const result = await cloudflareResponse.json();
    const allowedHostnames = String(process.env.TURNSTILE_ALLOWED_HOSTNAMES || '')
      .split(',')
      .map((hostname) => hostname.trim().toLowerCase())
      .filter(Boolean);
    const hostnames = allowedHostnames.length ? allowedHostnames : DEFAULT_HOSTNAMES;
    const hostnameIsAllowed = hostnames.includes(String(result.hostname || '').toLowerCase());
    const actionIsValid = result.action === 'convert';

    if (!result.success || !hostnameIsAllowed || !actionIsValid) {
      console.warn('Turnstile verification rejected', {
        success: Boolean(result.success),
        hostname: result.hostname || '',
        action: result.action || '',
        errors: result['error-codes'] || []
      });
      return response.status(403).json({ success: false, error: 'verification_failed' });
    }

    return response.status(200).json({ success: true });
  } catch (error) {
    console.error('Turnstile verification request failed', error);
    return response.status(502).json({ success: false, error: 'verification_unavailable' });
  }
};
