export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: 'AI is not configured. Add OPENAI_API_KEY to the Vercel project environment variables.' });
    return;
  }

  const { player, brief } = req.body || {};
  if (!player) {
    res.status(400).json({ error: 'A player profile is required.' });
    return;
  }

  const system = `You are WTS Scout, an evidence-led football scouting assistant. Never invent statistics or observations. Separate supplied facts from scouting interpretation. Produce concise, professional recruitment intelligence. For minors, avoid sensitive personal information and do not make claims about medical, psychological, or contractual matters unless explicitly supplied.`;
  const prompt = `Create a scouting report for this player. Recruitment brief: ${brief || 'General professional scouting assessment.'}\n\nPlayer data:\n${JSON.stringify(player, null, 2)}\n\nReturn JSON with keys: summary, strengths (array), developmentAreas (array), tacticalFit, evidenceToVerify (array), nextObservation, fitScore (0-100). The fitScore must reflect only the supplied brief/data and should be described as an internal screening aid, not a prediction of career outcome.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_SCOUT_MODEL || 'gpt-4.1-mini',
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt },
        ],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('OpenAI scout error', data);
      res.status(502).json({ error: 'The AI scouting service returned an error.' });
      return;
    }

    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      res.status(502).json({ error: 'The AI scouting service returned no report.' });
      return;
    }

    res.status(200).json(JSON.parse(content));
  } catch (error) {
    console.error('Scout report handler error', error);
    res.status(500).json({ error: 'Unable to generate the scouting report.' });
  }
}
