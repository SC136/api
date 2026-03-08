import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const imageFile = formData.get("image") as File;
        const modelKey = (formData.get("model") as string) || "plant-vit";

        if (!imageFile) {
            return NextResponse.json({ error: "No image provided" }, { status: 400 });
        }

        // Forward to local Python server
        const localFormData = new FormData();
        localFormData.append("image", imageFile);
        localFormData.append("model", modelKey);

        const response = await fetch("http://localhost:5000/plant", {
            method: "POST",
            body: localFormData,
        });

        if (!response.ok) {
            let errorMessage = "Failed to analyze plant image";
            try {
                const errorData = await response.json();
                errorMessage = errorData.error || errorMessage;
            } catch {
                errorMessage = response.statusText || errorMessage;
            }
            return NextResponse.json(
                { error: errorMessage },
                { status: response.status }
            );
        }

        const data = await response.json();
        return NextResponse.json({
            predictions: data.predictions,
            model: data.model,
        });
    } catch (error: any) {
        console.error("Error processing plant image:", error);
        return NextResponse.json(
            { error: error.message || "Failed to connect to plant analysis service. Make sure the Python server is running on port 5000." },
            { status: 500 }
        );
    }
}
