import { generateText, Output } from 'ai';
import { z } from 'zod';
import { db } from './_lib/db.js';
import { requireAuth, assertSameOrigin } from './_lib/auth.js';

const reportSchema = z.object({
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

  return reportSchema.parse(JSON.parse(text));
}

async function generateWithGateway({ prompt, system }) {
  const model = process.env.WTS_SCOUT_MODEL || 'openai/gpt-5.4';
  const result = await generateText({
    model,
    system,
    prompt,
    temperature: 0.2,
    output: Output.object({ schema: reportSchema }),
  });
  return result.output;
}

export default async function handler(request, response) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed.' });

  try {
    const auth = await requireAuth(request, { workspaceRoles: ['owner', 'scout', 'analyst'] });
    assertSameOrigin(request);
    const body = request.body || await request.json();
    if (!body?.player?.id || !/^[0-9a-fA-F-]{36}$/.test(body.player.id)) return response.status(400).json({ error: 'A valid saved player profile is required.' });
    const [player] = await db()`select * from player_profiles where id = ${body.player.id}::uuid and workspace_id = ${auth.workspace.id} limit 1`;
    if (!player) return response.status(404).json({ error: 'Player is not in your workspace.' });

    const provider = process.env.WTS_SCOUT_PROVIDER || (process.env.GEMINI_API_KEY ? 'gemini' : 'gateway');
    const system = `You are WTS Scout, an evidence-led football scouting assistant. Never invent statistics, observations or player history. Separate supplied facts from scouting interpretation. Produce concise professional recruitment intelligence. For minors, avoid sensitive personal information and do not make claims about medical, psychological, contractual or family matters unless explicitly supplied. The fitScore is an internal screening aid only, not a prediction of career outcome.`;
    const prompt = `Create a structured scouting report. Recruitment brief: ${body.brief || 'General professional scouting assessment.'}\\n\\nPlayer data:\\n${JSON.stringify(player, null, 2)}`;

    const output = provider === 'gemini'
      ? await generateWithGemini({ prompt, system })
      : await generateWithGateway({ prompt, system });

    return response.status(200).json(output);
  } catch (error) {
    console.error('WTS AI scouting error', error);
    const status = error?.status || 502;
    return response.status(status).json({
      error: status === 401 ? 'Authentication required.' :
        status === 403 ? error.message :
        status === 429 ? 'AI rate limit reached. Please try again later.' :
        'The WTS AI scouting service could not generate a report.',
    });
  }
}
