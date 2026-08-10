import { groq } from "@/lib/groq";

export interface StructuredNotes {
  title: string;
  summary: string;
  language: string;
  speakerCount: number;
  duration: string;
  structuredNotes: string;    // full markdown document
  keyPoints: string[];
  actionItems: string[];
  topics: string[];
}

const NOTES_SYSTEM_PROMPT = `You are an expert note-taker and content analyst. Your job is to transform raw video transcripts into comprehensive, well-structured notes that capture every important detail while being easy to read and reference.

You must respond with ONLY a valid JSON object — no markdown fences, no explanation, just the JSON.`;

const NOTES_USER_PROMPT = (transcript: string, title: string) => `
Transform this video transcript into comprehensive structured notes.

Video title: "${title}"
Transcript:
${transcript}

Return ONLY this JSON structure:
{
  "title": "improved video title based on content",
  "summary": "2-3 sentence executive summary of the entire video",
  "language": "detected language (e.g. English, Telugu, Hindi)",
  "speakerCount": 1,
  "duration": "estimated reading time of notes",
  "keyPoints": [
    "Key point 1 — specific and actionable",
    "Key point 2",
    "Key point 3"
  ],
  "actionItems": [
    "Action item extracted from video",
    "Next step mentioned"
  ],
  "topics": ["topic1", "topic2", "topic3"],
  "structuredNotes": "# Video Title\\n\\n## Overview\\n\\nBrief intro...\\n\\n## [00:00] Section Name\\n\\nContent with **bold** for emphasis, bullet points for lists...\\n\\n### Key Concepts\\n\\n- Concept 1: explanation\\n\\n## Summary\\n\\nConclusion..."
}

Rules for structuredNotes (markdown format):
- Start with # Title and ## Overview
- Use ## [MM:SS] Section headings with approximate timestamps
- Use **bold** for key terms and important concepts  
- Use bullet points (- ) for lists and examples
- Use numbered lists (1.) for steps and sequences
- Use > blockquotes for direct quotes from the speaker
- Use \`code\` for technical terms, commands, function names
- Use \`\`\`language code blocks\`\`\` for any code snippets mentioned
- Add ### Key Concepts section listing defined terms with explanations
- Add ### Action Items section if any tasks/next steps were mentioned
- End with ## Summary section
- Preserve ALL important information — do not omit anything significant
- If multiple speakers, prefix their content with **Speaker 1:** / **Speaker 2:**
- Minimum 500 words for notes — be thorough and comprehensive`;

export async function generateStructuredNotes(
  transcript: string,
  videoTitle: string
): Promise<StructuredNotes> {
  // truncate very long transcripts to stay within context limits
  const truncated = transcript.slice(0, 14000);

  const response = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: NOTES_SYSTEM_PROMPT },
      { role: "user", content: NOTES_USER_PROMPT(truncated, videoTitle) },
    ],
    temperature: 0.2,
    max_tokens: 4000,
    response_format: { type: "json_object" },
  });

  const raw = response.choices[0]?.message?.content ?? "{}";

  let parsed: StructuredNotes;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // fallback if JSON parse fails
    parsed = {
      title: videoTitle,
      summary: "Could not generate summary.",
      language: "English",
      speakerCount: 1,
      duration: "Unknown",
      structuredNotes: `# ${videoTitle}\n\n## Transcript\n\n${transcript.slice(0, 3000)}`,
      keyPoints: [],
      actionItems: [],
      topics: [],
    };
  }

  // validate arrays
  if (!Array.isArray(parsed.keyPoints)) parsed.keyPoints = [];
  if (!Array.isArray(parsed.actionItems)) parsed.actionItems = [];
  if (!Array.isArray(parsed.topics)) parsed.topics = [];

  return parsed;
}