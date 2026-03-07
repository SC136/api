import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    try {
        const response = await fetch("https://wise-reasonably-glider.ngrok-free.app/models");

        if (!response.ok) {
            return NextResponse.json(
                { error: "Failed to fetch models" },
                { status: response.status }
            );
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error: any) {
        console.error("Error fetching models:", error);
        return NextResponse.json(
            { error: "Failed to connect to model service" },
            { status: 500 }
        );
    }
}
