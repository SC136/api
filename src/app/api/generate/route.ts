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

    const response = await fetch("https://wise-reasonably-glider.ngrok-free.app/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        model: modelKey,
        max_new_tokens: maxNewTokens,
        temperature,
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
