import express from 'express';
import { processSandyBrain } from './sandy-brain/sandy-brain';
import { SandyBrainInput } from './sandy-brain/types';
import cors from 'cors';
import 'dotenv/config';

const app = express();
app.use(cors());
app.use(express.json());

const AUTH_TOKEN = process.env.AUTH_TOKEN || 'datadriverpro2026';

// Auth middleware
function auth(req: any, res: any, next: any) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token !== AUTH_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'ddpro-config-api' });
});

app.post('/sandy-brain', auth, async (req, res) => {
  try {
    const input: SandyBrainInput = req.body;
    const output = await processSandyBrain(input);
    res.json(output);
  } catch (error: any) {
    console.error('Sandy Brain API error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/config', auth, (_req, res) => {
  res.json({
    urls: {
      'audiencelab': process.env.URL_AUDIENCELAB || '',
      'liveavatar': process.env.URL_LIVEAVATAR || '',
      'sandy-sms': process.env.URL_SANDY_SMS || '',
      'fb-pipeline': process.env.URL_FB_PIPELINE || '',
      'li-pipeline': process.env.URL_LI_PIPELINE || '',
      'li-validator': process.env.URL_LI_VALIDATOR || '',
      'dd-api': process.env.URL_DD_API || ''
    },
    keys: {
      'SUPABASE_ANON_KEY': process.env.SUPABASE_ANON_KEY || '',
      'AGENT_SUPABASE_ANON_KEY': process.env.AGENT_SUPABASE_ANON_KEY || '',
      'APIFY_TOKEN': process.env.APIFY_TOKEN || '',
      'PB_KEY': process.env.PB_KEY || '',
      'GHL_API_KEY': process.env.GHL_API_KEY || '',
      'GHL_LOCATION_ID': process.env.GHL_LOCATION_ID || '',
      'ELEVENLABS_API_KEY': process.env.ELEVENLABS_API_KEY || '',
      'LIVEAVATAR_API_KEY': process.env.LIVEAVATAR_API_KEY || '',
      'STRIPE_SECRET_KEY': process.env.STRIPE_SECRET_KEY || '',
      'MAKE_API_KEY': process.env.MAKE_API_KEY || '',
      'VAPI_API_KEY': process.env.VAPI_API_KEY || '',
      'TWILIO_ACCOUNT_SID': process.env.TWILIO_ACCOUNT_SID || '',
      'TWILIO_AUTH_TOKEN': process.env.TWILIO_AUTH_TOKEN || '',
      'COGNEE_API_KEY': process.env.COGNEE_API_KEY || ''
    }
  });
});

const PORT = parseInt(process.env.PORT || '3000');
if (!process.env.VERCEL) {
  app.listen(PORT, () => console.log(`ddpro-config-api listening on port ${PORT}`));
}

export default app;
