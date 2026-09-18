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
};

const PROVIDERS = Object.freeze({
  GEMINI: 'gemini',
});

function providerFromEnv() {
  const provider = (process.env.WTS_SCOUT_PROVIDER || PROVIDERS.GEMINI).toLowerCase();
  if (provider !== PROVIDERS.GEMINI) {
    throw Object.assign(new Error(`Unsupported WTS Scout AI provider: ${provider}`), { status: 503 });
  }
  return provider;
}

async function generateWithGemini({ prompt, system }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw Object.assign(new Error('Gemini is not configured.'), { status: 503 });

  const model = process.env.WTS_SCOUT_GEMINI_MODEL || 'gemini-2.5-flash-lite';
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
          responseSchema: reportJsonSchema,
        },
      }),
    },
  );

  if (!response.ok) {
    const details = await response.text();
    console.error('WTS Gemini request failed', response.status, details.slice(0, 1000));
    throw Object.assign(new Error('Gemini request failed.'), { status: response.status === 429 ? 429 : 502 });
  }

  const payload = await response.json();
  const text = payload?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('').trim();
  if (!text) throw Object.assign(new Error('Gemini returned no report.'), { status: 502 });

  return scoutingReportSchema.parse(JSON.parse(text));
}

export function getScoutingAI() {
  const provider = providerFromEnv();

  // Provider interface: the application only depends on this contract.
  // A future paid adapter can implement the same generateStructured method
  // without changing API routes, persistence, or UI code.
  if (provider === PROVIDERS.GEMINI) {
    return {
      provider,
      model: process.env.WTS_SCOUT_GEMINI_MODEL || 'gemini-2.5-flash-lite',
      async generateStructured(input) {
        return generateWithGemini(input);
      },
    };
  }

  throw Object.assign(new Error('No WTS Scout AI provider is available.'), { status: 503 });
}

export function getScoutingProviderStatus() {
  const provider = providerFromEnv();
  return {
    provider,
    model: process.env.WTS_SCOUT_GEMINI_MODEL || 'gemini-2.5-flash-lite',
    configured: Boolean(process.env.GEMINI_API_KEY),
  };
}
