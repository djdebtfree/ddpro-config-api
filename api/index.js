module.exports = (req, res) => {
  const url = req.url.split('?')[0];

  if (url === '/health' || url === '/' || url === '') {
    return res.json({ status: 'ok', service: 'ddpro-config-api' });
  }

  if (url === '/config') {
    const AUTH_TOKEN = process.env.AUTH_TOKEN || 'datadriverpro2026';
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    if (token !== AUTH_TOKEN) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    return res.json({
      urls: {
        audiencelab: process.env.URL_AUDIENCELAB || '',
        liveavatar: process.env.URL_LIVEAVATAR || '',
        'sandy-sms': process.env.URL_SANDY_SMS || '',
        'fb-pipeline': process.env.URL_FB_PIPELINE || '',
        'li-pipeline': process.env.URL_LI_PIPELINE || '',
        'li-validator': process.env.URL_LI_VALIDATOR || '',
        'dd-api': process.env.URL_DD_API || ''
      },
      keys: {
        SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
        AGENT_SUPABASE_ANON_KEY: process.env.AGENT_SUPABASE_ANON_KEY || '',
        APIFY_TOKEN: process.env.APIFY_TOKEN || '',
        PB_KEY: process.env.PB_KEY || '',
        GHL_API_KEY: process.env.GHL_API_KEY || '',
        GHL_LOCATION_ID: process.env.GHL_LOCATION_ID || '',
        ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY || '',
        LIVEAVATAR_API_KEY: process.env.LIVEAVATAR_API_KEY || '',
        STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || '',
        MAKE_API_KEY: process.env.MAKE_API_KEY || '',
        VAPI_API_KEY: process.env.VAPI_API_KEY || '',
        TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || '',
        TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN || '',
        COGNEE_API_KEY: process.env.COGNEE_API_KEY || ''
      }
    });
  }

  res.status(404).json({ error: 'Not found' });
};
