import { NextRequest, NextResponse } from "next/server";

type Message = {
  role: "user" | "assistant" | "system";
  content: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const messages: Message[] = body?.messages || [];
    const modelKey = (body?.model as string) || "smollm2-1.7b";
    const maxNewTokens = body?.max_new_tokens ?? 128;
    const temperature = body?.temperature ?? 0.7;

    if (!messages.length) {
      return NextResponse.json(
        { error: "Messages array is required" },
        { status: 400 }
      );
    }

    // Build a single prompt from the conversation history
    const lastUserMsg = messages.filter((m) => m.role === "user").pop();
    if (!lastUserMsg) {
      return NextResponse.json(
        { error: "At least one user message is required" },
        { status: 400 }
      );
    }

    // Format conversation context for the LLM
    const contextParts = messages.map((m) => {
      if (m.role === "system") return `System: ${m.content}`;
      if (m.role === "user") return `User: ${m.content}`;
      return `Assistant: ${m.content}`;
    });
    const prompt = contextParts.join("\n") + "\nAssistant:";

    const response = await fetch("http://localhost:5000/generate", {
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
        { error: errorData.error || "Failed to generate response" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({
      message: { role: "assistant", content: data.text },
      model: data.model,
    });
  } catch (error: any) {
    console.error("Chat error:", error);
    return NextResponse.json(
      {
        error:
          error?.message ||
          "Failed to connect to chat service. Make sure the Python server is running on port 5000.",
      },
      { status: 500 }
    );
  }
}
