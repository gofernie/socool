export const prerender = false;

export async function POST({ request }) {
  const { heading, intro, city, type } = await request.json();

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": import.meta.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: `Write a meta description for a real estate page. Keep it under 155 characters. Be specific and useful to a buyer. No quotes.

Page heading: ${heading}
Intro copy: ${intro}
City: ${city}
Property type: ${type}

Return only the meta description text, nothing else.`
      }]
    })
  });

  const data = await response.json();
  const text = data.content?.[0]?.text?.trim() || "";

  return new Response(JSON.stringify({ text }), {
    headers: { "Content-Type": "application/json" }
  });
}