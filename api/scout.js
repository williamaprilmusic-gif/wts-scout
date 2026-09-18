import { db } from './_lib/db.js';
import { requireAuth, assertSameOrigin } from './_lib/auth.js';
import { getScoutingAI, scoutingReportSchema } from './_lib/ai.js';

const MAX_BRIEF_LENGTH = 4000;

export default async function handler(request, response) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed.' });

  try {
    const auth = await requireAuth(request, { workspaceRoles: ['owner', 'scout', 'analyst'] });
    assertSameOrigin(request);

    const body = request.body || await request.json();
    if (!body?.player?.id || !/^[0-9a-fA-F-]{36}$/.test(body.player.id)) {
      return response.status(400).json({ error: 'A valid saved player profile is required.' });
    }

    const brief = typeof body.brief === 'string'
      ? body.brief.trim().slice(0, MAX_BRIEF_LENGTH)
      : 'General professional scouting assessment.';

    const [player] = await db()`select * from player_profiles where id = ${body.player.id}::uuid and workspace_id = ${auth.workspace.id} limit 1`;
    if (!player) return response.status(404).json({ error: 'Player is not in your workspace.' });

    const system = `You are WTS Scout, an evidence-led football scouting assistant. Never invent statistics, observations or player history. Separate supplied facts from scouting interpretation. Produce concise professional recruitment intelligence. For minors, avoid sensitive personal information and do not make claims about medical, psychological, contractual or family matters unless explicitly supplied. The fitScore is an internal screening aid only, not a prediction of career outcome.`;
    const prompt = `Create a structured scouting report. Recruitment brief: ${brief}\\n\\nPlayer data:\\n${JSON.stringify(player, null, 2)}`;

    const ai = getScoutingAI();
    const output = scoutingReportSchema.parse(await ai.generateStructured({ prompt, system }));

    return response.status(200).json({
      provider: ai.provider,
      model: ai.model,
      report: output,
    });
  } catch (error) {
    console.error('WTS AI scouting error', error);
    const status = error?.status || 502;
    return response.status(status).json({
      error: status === 401 ? 'Authentication required.' :
        status === 403 ? error.message :
        status === 429 ? 'AI rate limit reached. Please try again later.' :
        status === 503 ? 'WTS Scout AI is not configured.' :
        'The WTS AI scouting service could not generate a report.',
    });
  }
}
