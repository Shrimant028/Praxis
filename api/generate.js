export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle OPTIONS preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { type, insight, qa } = req.body;

    if (!process.env.GROQ_API_KEY) {
        return res.status(500).json({ error: 'GROQ_API_KEY not configured' });
    }

    try {
        if (type === 'questions') {
            return await generateQuestions(res, insight);
        } else if (type === 'intention') {
            return await generateIntention(res, insight, qa);
        } else {
            return res.status(400).json({ error: 'Invalid type' });
        }
    } catch (error) {
        console.error('Error:', error.message);
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
}

async function generateQuestions(res, insight) {
    const systemPrompt = `You are Praxis — a behavioral conversion engine, not a coach.
Your job is NOT to motivate, summarize, or validate.
Force the user to convert a theoretical insight into concrete behavioral change through targeted interrogation.

Generate exactly 5 questions specific to the user's insight.
Q1: Situational grounding — what does this mean for their exact current life right now?
Q2: Identity confrontation — what behavior or belief of theirs does this directly contradict?
Q3: Pattern surfacing — they've had this insight before. What happened last time?
Q4: Blocker diagnosis — not the general excuse, the real specific blocker.
Q5: Micro-action seed — the smallest physical action tomorrow that proves this insight is real.

Rules:
- Questions must feel uncomfortable to answer honestly
- Be specific to what the user wrote, not generic
- Vary question length

Return ONLY a valid JSON array of exactly 5 strings. No explanation, no markdown, no preamble.
Example: ["question1","question2","question3","question4","question5"]`;

    const response = await callGroqAPI(systemPrompt, insight);
    
    try {
        const questions = JSON.parse(response);
        if (!Array.isArray(questions) || questions.length !== 5) {
            throw new Error('Expected array of 5 questions');
        }
        return res.status(200).json({ questions });
    } catch (error) {
        console.error('Failed to parse questions response:', response);
        throw new Error('Failed to generate questions');
    }
}

async function generateIntention(res, insight, qa) {
    const systemPrompt = `You are Praxis. You have interrogated a user through 5 targeted questions about an insight.
Based on their specific answers, generate ONE implementation intention.

Rules:
- The cue must be an existing daily event, not a time (not "at 9am", yes "after I make chai")
- The action must be completable in under 5 minutes
- Everything must feel specific to this person, not generic
- The why must reference something they actually said

Return ONLY valid JSON, no markdown, no explanation:
{
  "full": "If [existing daily event], then I will [specific micro-action].",
  "why": "one specific sentence connecting this to what they shared"
}`;

    const userMessage = `Insight: ` + insight + `\n\nQ&A:\n` + qa.map((item, i) => `Q` + (i + 1) + `: ` + item.q + `\nA` + (i + 1) + `: ` + item.a).join('\n\n');

    const response = await callGroqAPI(systemPrompt, userMessage);
    
    try {
        const intention = JSON.parse(response);
        if (!intention.full || !intention.why) {
            throw new Error('Missing full or why field');
        }
        return res.status(200).json(intention);
    } catch (error) {
        console.error('Failed to parse intention response:', response);
        throw new Error('Failed to generate intention');
    }
}

async function callGroqAPI(systemPrompt, userMessage) {
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': 'Bearer ' + process.env.GROQ_API_KEY,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userMessage }
            ],
            temperature: 0.7,
            max_tokens: 1024
        })
    });

    if (!groqResponse.ok) {
        const error = await groqResponse.text();
        throw new Error(`Groq API error: ` + groqResponse.status + ` ` + error);
    }

    const data = await groqResponse.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Unexpected Groq API response format');
    }

    return data.choices[0].message.content;
}