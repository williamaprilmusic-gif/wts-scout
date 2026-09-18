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

export default async function handler(request, response) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed.' });

  try {
    const auth = await requireAuth(request, { workspaceRoles: ['owner', 'scout', 'analyst'] });
    assertSameOrigin(request);
    const body = request.body || await request.json();
    if (!body?.player?.id) return response.status(400).json({ error: 'A saved player profile is required.' });
    const [player] = await db()`select * from player_profiles where id = ${body.player.id}::uuid and workspace_id = ${auth.workspace.id} limit 1`;
    if (!player) return response.status(404).json({ error: 'Player is not in your workspace.' });

    const model = process.env.WTS_SCOUT_MODEL || 'openai/gpt-5.4';
    const system = `You are WTS Scout, an evidence-led football scouting assistant. Never invent statistics, observations or player history. Separate supplied facts from scouting interpretation. Produce concise professional recruitment intelligence. For minors, avoid sensitive personal information and do not make claims about medical, psychological, contractual or family matters unless explicitly supplied. The fitScore is an internal screening aid only, not a prediction of career outcome.`;
    const prompt = `Create a structured scouting report. Recruitment brief: ${body.brief || 'General professional scouting assessment.'}\n\nPlayer data:\n${JSON.stringify(player, null, 2)}`;

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
    const status = error?.status || 502;
    return response.status(status).json({ error: status === 401 ? 'Authentication required.' : status === 403 ? error.message : 'The WTS AI scouting service could not generate a report.' });
  }
}
