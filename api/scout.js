import { generateText, Output } from 'ai';
import { z } from 'zod';

const reportSchema = z.object({
  summary: z.string(),
  strengths: z.array(z.string()),
  developmentAreas: z.array(z.string()),
  tacticalFit: z.string(),
  evidenceToVerify: z.array(z.string()),
  nextObservation: z.string(),
  fitScore: z.number().int().min(0).max(100),
});

export default async function handler(request, response) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed.' });

  const body = request.body || await request.json();
  if (!body?.player) return response.status(400).json({ error: 'A player profile is required.' });

  const model = process.env.WTS_SCOUT_MODEL || 'openai/gpt-5.4';
  const system = `You are WTS Scout, an evidence-led football scouting assistant. Never invent statistics, observations or player history. Separate supplied facts from scouting interpretation. Produce concise professional recruitment intelligence. For minors, avoid sensitive personal information and do not make claims about medical, psychological, contractual or family matters unless explicitly supplied. The fitScore is an internal screening aid only, not a prediction of career outcome.`;
  const prompt = `Create a structured scouting report. Recruitment brief: ${body.brief || 'General professional scouting assessment.'}\n\nPlayer data:\n${JSON.stringify(body.player, null, 2)}`;

  try {
    const result = await generateText({
      model,
      system,
      prompt,
      temperature: 0.2,
      output: Output.object({ schema: reportSchema }),
    });
    return response.status(200).json(result.output);
  } catch (error) {
    console.error('WTS AI scouting error', error);
    return response.status(502).json({ error: 'The WTS AI scouting service could not generate a report.' });
  }
}
