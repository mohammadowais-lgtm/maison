import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const MODEL = "openai/gpt-6-astra";

async function callStylist(content: unknown[], schemaName: string, schema: object): Promise<any> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("AI is not configured.");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: MODEL,
      stream: true,
      store: false,
      reasoning: { effort: "low" },
      input: [{ role: "user", content }],
      text: { format: { type: "json_schema", name: schemaName, strict: true, schema } },
    }),
  });
  if (!res.ok || !res.body) {
    let msg = `Stylist unavailable (${res.status})`;
    try {
      const j = await res.json();
      msg = j?.error?.message || j?.message || msg;
    } catch {}
    if (res.status === 429) msg = "Too many requests — please wait a moment and try again.";
    if (res.status === 402) msg = "AI credits are exhausted. Please top up to continue.";
    throw new Error(msg);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const ev = JSON.parse(data);
        if (ev.type === "response.output_text.delta") text += ev.delta;
        if (ev.type === "error" || ev.type === "response.failed")
          throw new Error(ev?.error?.message || ev?.response?.error?.message || "Stylist failed.");
      } catch (e) {
        if (e instanceof SyntaxError) continue;
        throw e;
      }
    }
  }
  if (!text.trim()) throw new Error("The stylist couldn't respond to this request.");
  return JSON.parse(text);
}

export const tagItem = createServerFn({ method: "POST" })
  .inputValidator((d: { image: string }) => z.object({ image: z.string().min(20).max(2_000_000) }).parse(d))
  .handler(async ({ data }) => {
    return (await callStylist(
      [
        {
          type: "input_text",
          text: "You are a luxury fashion stylist. Identify this single clothing item or accessory. Give a short elegant name, its category, dominant colour, and which occasions it suits.",
        },
        { type: "input_image", image_url: data.image },
      ],
      "garment",
      {
        type: "object",
        additionalProperties: false,
        required: ["name", "category", "color", "styles"],
        properties: {
          name: { type: "string" },
          category: { type: "string", enum: ["top", "bottom", "dress", "outerwear", "shoes", "accessory", "traditional"] },
          color: { type: "string" },
          styles: {
            type: "array",
            items: { type: "string", enum: ["casual", "party", "traditional", "formal", "sporty"] },
          },
        },
      },
    )) as { name: string; category: string; color: string; styles: string[] };
  });

const itemSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  color: z.string(),
  styles: z.array(z.string()),
  image: z.string().max(2_000_000),
});

export const suggestOutfit = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ occasion: z.string().max(60), note: z.string().max(300), items: z.array(itemSchema).min(1).max(40) }).parse(d),
  )
  .handler(async ({ data }) => {
    const content: unknown[] = [
      {
        type: "input_text",
        text: `You are a world-class personal stylist. From the wardrobe below, compose the single best complete outfit for: ${data.occasion}. ${data.note ? `Extra wishes: ${data.note}.` : ""} Only use item ids listed. Pick a coherent set (e.g. top+bottom+shoes, or dress+shoes, plus optional outerwear/accessory). Give a poetic look title, a 2-sentence explanation of why it works, and one styling tip.`,
      },
    ];
    for (const it of data.items) {
      content.push({ type: "input_text", text: `id=${it.id} | ${it.name} | ${it.category} | ${it.color} | ${it.styles.join(",")}` });
      content.push({ type: "input_image", image_url: it.image });
    }
    return (await callStylist(content, "outfit", {
      type: "object",
      additionalProperties: false,
      required: ["title", "itemIds", "why", "tip"],
      properties: {
        title: { type: "string" },
        itemIds: { type: "array", items: { type: "string" } },
        why: { type: "string" },
        tip: { type: "string" },
      },
    })) as { title: string; itemIds: string[]; why: string; tip: string };
  });
