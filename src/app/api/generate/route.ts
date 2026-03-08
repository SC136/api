import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const prompt = (body?.prompt as string) || "";
    const modelKey = (body?.model as string) || "smollm2-1.7b";
    const maxNewTokens = body?.max_new_tokens ?? 256;
    const temperature = body?.temperature ?? 0.7;

    if (!prompt.trim()) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const topP = body?.top_p ?? 0.9;
    const topK = body?.top_k ?? 50;
    const repetitionPenalty = body?.repetition_penalty ?? 1.2;

    const response = await fetch("http://localhost:5000/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        model: modelKey,
        max_new_tokens: maxNewTokens,
        temperature,
        top_p: topP,
        top_k: topK,
        repetition_penalty: repetitionPenalty,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.error || "Failed to generate text" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({ text: data.text, model: data.model });
  } catch (error: any) {
    console.error("Error generating text:", error);
    return NextResponse.json(
      {
        error:
          error?.message ||
          "Failed to connect to text generation service. Make sure the Python server is running on port 5000.",
      },
      { status: 500 }
    );
  }
}
