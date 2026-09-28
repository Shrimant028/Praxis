// Praxis — Vercel Serverless Function
// Uses Groq (llama-3.3-70b-versatile) to generate interrogation questions
// and synthesize implementation intentions.

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "openai/gpt-oss-120b";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

const QUESTIONS_SYSTEM = `You are Praxis — a behavioral conversion engine, not a coach.
Your job is NOT to motivate, summarize, or validate.
Force the user to convert theoretical insight into concrete behavioral change.

Generate exactly 5 questions specific to the user's insight:
Q1: Situational grounding — what does this mean for their exact life right now?
Q2: Identity confrontation — what behavior or belief does this directly contradict?
Q3: Pattern surfacing — they've had this insight before. What happened last time?
Q4: Blocker diagnosis — the real specific blocker, not the general excuse.
Q5: Micro-action seed — smallest physical action tomorrow proving this insight is real.

Rules:
- Feel uncomfortable to answer honestly
- Hyper-specific to what the user wrote
- Some short and brutal, some longer

Return ONLY a JSON array of exactly 5 strings. No markdown. No preamble.
["q1","q2","q3","q4","q5"]`;

const INTENTION_SYSTEM = `You are Praxis. Generate ONE implementation intention from the user's interrogation session.

Rules:
- Cue must be an existing daily event (not a clock time — yes "after I make chai", not "at 9am")
- Action completable in under 5 minutes
- Hyper-specific to this person, not generic
- Why must reference something they actually said

Return ONLY JSON, no markdown:
{"full":"If [cue], then I will [action].","why":"one sentence referencing their actual words"}`;

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, CORS_HEADERS);
  res.end(JSON.stringify(body));
}

async function callGroq(systemPrompt, userPrompt) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not configured on the server.");
  }

  const response = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.85,
      max_tokens: 800,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Groq API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Empty response from Groq.");
  }
  return content.trim();
}

function stripCodeFences(text) {
  // Some models wrap JSON in ```json ... ``` despite instructions. Strip them.
  let t = text.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  }
  return t.trim();
}

function safeParseArray(text) {
  const cleaned = stripCodeFences(text);
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (e2) {
        return null;
      }
    }
    return null;
  }
}

function safeParseObject(text) {
  const cleaned = stripCodeFences(text);
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (e2) {
        return null;
      }
    }
    return null;
  }
}

module.exports = async (req, res) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  let body;
  try {
    body =
      typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
  } catch (e) {
    return sendJson(res, 400, { error: "Invalid JSON body" });
  }

  const { type, insight, qa } = body;

  if (!type || !insight) {
    return sendJson(res, 400, {
      error: "Missing required fields: type, insight",
    });
  }

  try {
    if (type === "questions") {
      const raw = await callGroq(QUESTIONS_SYSTEM, insight);
      const questions = safeParseArray(raw);

      if (!Array.isArray(questions) || questions.length !== 5) {
        return sendJson(res, 500, { error: "Parse failed" });
      }

      return sendJson(res, 200, { questions });
    }

    if (type === "intention") {
      const userPrompt = `Insight:\n${insight}\n\nInterrogation Q&A:\n${
        qa || ""
      }`;
      const raw = await callGroq(INTENTION_SYSTEM, userPrompt);
      const parsed = safeParseObject(raw);

      if (!parsed || !parsed.full || !parsed.why) {
        return sendJson(res, 500, { error: "Parse failed" });
      }

      return sendJson(res, 200, { full: parsed.full, why: parsed.why });
    }

    return sendJson(res, 400, { error: "Unknown type" });
  } catch (err) {
    console.error("[/api/generate] error:", err);
    return sendJson(res, 500, {
      error: err.message || "Server error",
    });
  }
};
