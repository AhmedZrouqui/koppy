export async function rewriteDescription(title: string, originalHtml: string): Promise<string> {
  // If no API key, return original to keep the flow moving
  if (!process.env.OPENAI_API_KEY) return originalHtml;

  const prompt = `
    You are an e-commerce SEO expert. 
    Rewrite the following product description for a product titled "${title}".
    Maintain the technical specs but change the marketing copy to be unique and persuasive.
    Return ONLY the HTML.
    Original: ${originalHtml}
  `;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
        model: "gpt-4o-mini", // Lower cost, plenty of "vibe" for product copy
        messages: [{ 
        role: "system", 
        content: "You are a Shopify SEO expert. Rewrite descriptions to be unique but keep technical specs intact. Output ONLY valid HTML." 
        },
        { 
        role: "user", 
        content: `Rewrite this: ${originalHtml}` 
        }],
        max_tokens: 1000,
    }),
    });

    const data = await response.json();
    return data.choices[0].message.content || originalHtml;
  } catch (error) {
    console.error("AI Rewrite failed:", error);
    return originalHtml;
  }
}