import { z } from 'zod';

export const scoutingReportSchema = z.object({
  summary: z.string(),
  strengths: z.array(z.string()),
  developmentAreas: z.array(z.string()),
  tacticalFit: z.string(),
  evidenceToVerify: z.array(z.string()),
  nextObservation: z.string(),
  fitScore: z.number().int().min(0).max(100),
});

const reportJsonSchema = {
  name: 'scouting_report',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      summary: { type: 'string' },
      strengths: { type: 'array', items: { type: 'string' } },
      developmentAreas: { type: 'array', items: { type: 'string' } },
      tacticalFit: { type: 'string' },
      evidenceToVerify: { type: 'array', items: { type: 'string' } },
      nextObservation: { type: 'string' },
      fitScore: { type: 'integer', minimum: 0, maximum: 100 },
    },
    required: ['summary', 'strengths', 'developmentAreas', 'tacticalFit', 'evidenceToVerify', 'nextObservation', 'fitScore'],
    additionalProperties: false,
  },
};

const DEFAULT_MODEL = 'google/gemini-2.5-flash-lite';
const GATEWAY_URL = 'https://ai-gateway.vercel.sh/v1/chat/completions';

function modelFromEnv() {
  return process.env.WTS_SCOUT_MODEL || DEFAULT_MODEL;
}

function gatewayConfigured() {
  return Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN);
}

async function generateWithGateway({ prompt, system }) {
  if (!gatewayConfigured()) {
    throw Object.assign(new Error('Vercel AI Gateway is not configured.'), { status: 503 });
  }

  const headers = {
    'Content-Type': 'application/json',
  };
  if (process.env.AI_GATEWAY_API_KEY) headers.Authorization = `Bearer ${process.env.AI_GATEWAY_API_KEY}`;
  if (process.env.VERCEL_OIDC_TOKEN) headers['x-vercel-oidc-token'] = process.env.VERCEL_OIDC_TOKEN;

  const response = await fetch(GATEWAY_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: modelFromEnv(),
      temperature: 0.2,
      max_tokens: 1400,
      response_format: { type: 'json_schema', json_schema: reportJsonSchema },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    console.error('WTS AI Gateway request failed', response.status, details.slice(0, 1000));
    throw Object.assign(new Error('AI Gateway request failed.'), { status: response.status === 429 ? 429 : 502 });
  }

  const payload = await response.json();
  const raw = payload?.choices?.[0]?.message?.content;
  const text = Array.isArray(raw) ? raw.map((part) => part?.text || '').join('') : raw;
  if (!text || typeof text !== 'string') throw Object.assign(new Error('AI Gateway returned no report.'), { status: 502 });

  try {
    return scoutingReportSchema.parse(JSON.parse(text));
  } catch (error) {
    console.error('WTS AI Gateway returned invalid report JSON', error);
    throw Object.assign(new Error('AI Gateway returned an invalid report.'), { status: 502 });
  }
}

export function getScoutingAI() {
  return {
    provider: 'vercel-ai-gateway',
    model: modelFromEnv(),
    async generateStructured(input) {
      return generateWithGateway(input);
    },
  };
}

export function getScoutingProviderStatus() {
  return {
    provider: 'vercel-ai-gateway',
    model: modelFromEnv(),
    configured: gatewayConfigured(),
    auth: process.env.AI_GATEWAY_API_KEY ? 'api-key' : process.env.VERCEL_OIDC_TOKEN ? 'oidc' : 'missing',
  };
}
