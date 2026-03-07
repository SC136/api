import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const imageFile = formData.get("image") as File;
        const modelKey = (formData.get("model") as string) || "florence-2";
        const question = (formData.get("question") as string) || "";
        const mode = (formData.get("mode") as string) || "";

        if (!imageFile) {
            return NextResponse.json({ error: "No image provided" }, { status: 400 });
        }

        // Forward to local Python server
        const localFormData = new FormData();
        localFormData.append("image", imageFile);
        localFormData.append("model", modelKey);
        if (mode) {
            localFormData.append("mode", mode);
        }
        if (question) {
            localFormData.append("question", question);
        }

        const response = await fetch("https://wise-reasonably-glider.ngrok-free.app/analyze", {
            method: "POST",
            body: localFormData,
        });

        if (!response.ok) {
            let errorMessage = "Failed to analyze image";
            try {
                const errorData = await response.json();
                errorMessage = errorData.error || errorMessage;
            } catch {
                // If response isn't JSON, use the status text
                errorMessage = response.statusText || errorMessage;
            }
            return NextResponse.json(
                { error: errorMessage },
                { status: response.status }
            );
        }

        const data = await response.json();
        return NextResponse.json({ text: data.text });
    } catch (error: any) {
        console.error("Error processing image:", error);
        return NextResponse.json(
            { error: error.message || "Failed to connect to image analysis service. Make sure the Python server is running on port 5000." },
            { status: 500 }
        );
    }
}
