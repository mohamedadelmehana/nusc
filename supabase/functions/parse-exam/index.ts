// NUSC Exam Generator — secure server-side AI extraction endpoint.
// Deploy with: supabase functions deploy parse-exam
// Set secret: supabase secrets set OPENAI_API_KEY=... OPENAI_MODEL=gpt-4o-mini
// Do NOT put the OpenAI key in GitHub Pages or js/config.js.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          type: { type: "string", enum: ["mcq", "tf", "written"] },
          prompt: { type: "string" },
          options: { type: "array", items: { type: "object", additionalProperties: false, properties: { text: { type: "string" } }, required: ["text"] } },
          marks: { type: "number" },
        },
        required: ["type", "prompt", "options", "marks"],
      },
    },
  },
  required: ["questions"],
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers: cors });
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return Response.json({ error: "AI service is not configured" }, { status: 503, headers: cors });
  try {
    const body = await req.json();
    const sourceText = String(body?.text || "").slice(0, 45000);
    if (sourceText.trim().length < 20) return Response.json({ error: "Not enough source text" }, { status: 400, headers: cors });
    const upstream = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini",
        input: [
          { role: "system", content: "Extract exam questions faithfully from the supplied document text. Do not solve questions and do not infer correct answers. Preserve the exact wording and all answer options. Classify objective multiple choice as mcq, true/false statements as tf, and essay/short response as written. If text is incomplete or unclear, preserve what is visible and do not invent missing words or options. Split numbered subquestions into separate question records. Output only the requested structured data." },
          { role: "user", content: sourceText },
        ],
        text: { format: { type: "json_schema", name: "nusc_exam_questions", strict: true, schema } },
        max_output_tokens: 12000,
      }),
    });
    const payload = await upstream.json();
    if (!upstream.ok) return Response.json({ error: payload?.error?.message || "AI provider error" }, { status: 502, headers: cors });
    const outputText = payload.output_text || payload.output?.flatMap((item: any) => item.content || []).find((part: any) => part.type === "output_text")?.text;
    if (!outputText) return Response.json({ error: "AI returned no structured text" }, { status: 502, headers: cors });
    const parsed = JSON.parse(outputText);
    return Response.json(parsed, { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unexpected extraction error" }, { status: 500, headers: cors });
  }
});
