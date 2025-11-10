const API_URL = "https://api-inference.huggingface.co/models/facebook/bart-large-mnli";

export async function classifyCategory(title: string, description: string, apiKey?: string): Promise<string> {
    const API_KEY = apiKey || process.env.HUGGINGFACE_API_KEY;

    console.log("🔍 [HUGGINGFACE] Classifying:", { title, description });
    console.log("🔑 [HUGGINGFACE] API_KEY exists:", !!API_KEY, "value length:", API_KEY?.length || 0);

    if (!API_KEY) {
        console.warn("❌ [HUGGINGFACE] API key missing - check .env.local file");
        return "Others";
    }

    const labels = ["Subscription", "Templates", "Coupon Code", "Art", "Others"];
    const input = `${title}. ${description}`;

    console.log("📤 [HUGGINGFACE] Sending request with input:", input);

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                inputs: input,
                parameters: { candidate_labels: labels },
            }),
        });

        console.log("📥 [HUGGINGFACE] Response status:", response.status);

        if (!response.ok) {
            console.error("❌ [HUGGINGFACE] API request failed:", response.status, response.statusText);
            return "Others";
        }

        const result = await response.json();
        console.log("📊 [HUGGINGFACE] API result:", result);

        if (result && result.labels && result.scores) {
            const topCategory = result.labels[0] || "Others";
            const topScore = result.scores[0] || 0;
            console.log("✅ [HUGGINGFACE] Classified as:", topCategory, "with score:", topScore);
            return topCategory;
        }

        console.warn("⚠️ [HUGGINGFACE] Unexpected API response format");
        return "Others";
    } catch (error) {
        console.error("❌ [HUGGINGFACE] Category classification failed:", error);
        return "Others";
    }
}
