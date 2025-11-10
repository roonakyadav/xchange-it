import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export async function classifyCategory(title: string, description: string, apiKey?: string): Promise<string> {
    const API_KEY = apiKey || process.env.GEMINI_API_KEY;
    const text = `${title} ${description}`.toLowerCase();

    console.log("🔍 [GEMINI] Classifying:", { title, description });
    console.log("🔑 [GEMINI] API_KEY exists:", !!API_KEY, "value length:", API_KEY?.length || 0);

    // If API key is missing, use keyword-based fallback
    if (!API_KEY) {
        console.warn("❌ [GEMINI] API key missing - using keyword fallback");
        return keywordBasedClassification(text);
    }

    try {
        // Initialize Gemini with the API key
        const genAIInstance = new GoogleGenerativeAI(API_KEY);
        const model = genAIInstance.getGenerativeModel({ model: "gemini-pro" });

        const categories = ["Subscription", "Templates", "Coupon Code", "Art", "Others"];
        const input = `${title}. ${description}`;

        const prompt = `Categorize the following product/service into exactly one of these categories: ${categories.join(', ')}.

Product: "${input}"

Respond with only the category name, nothing else. Choose the most appropriate category based on the content.`;

        console.log("📤 [GEMINI] Sending request with input:", input);

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const category = response.text().trim();

        console.log("📊 [GEMINI] API result:", category);

        // Validate that the response is one of our expected categories
        if (categories.includes(category)) {
            console.log("✅ [GEMINI] Classified as:", category);
            return category;
        } else {
            console.warn("⚠️ [GEMINI] Unexpected category:", category, "- using keyword fallback");
            return keywordBasedClassification(text);
        }

    } catch (error) {
        console.error("❌ [GEMINI] Category classification failed:", error);
        console.log("🔄 [GEMINI] Falling back to keyword-based classification");
        return keywordBasedClassification(text);
    }
}

// Keyword-based fallback classification
function keywordBasedClassification(text: string): string {
    console.log("🔤 [KEYWORD] Analyzing text:", text);

    // Subscription keywords
    if (text.includes('subscription') || text.includes('netflix') || text.includes('spotify') ||
        text.includes('prime') || text.includes('hulu') || text.includes('disney') ||
        text.includes('hbo') || text.includes('max') || text.includes('paramount') ||
        text.includes('hotstar') || text.includes('premium') || text.includes('monthly') ||
        text.includes('annual') || text.includes('yearly')) {
        console.log("✅ [KEYWORD] Classified as: Subscription");
        return 'Subscription';
    }

    // Templates keywords
    if (text.includes('template') || text.includes('design') || text.includes('psd') ||
        text.includes('figma') || text.includes('sketch') || text.includes('canva') ||
        text.includes('mockup') || text.includes('ui') || text.includes('ux')) {
        console.log("✅ [KEYWORD] Classified as: Templates");
        return 'Templates';
    }

    // Coupon Code keywords
    if (text.includes('coupon') || text.includes('code') || text.includes('discount') ||
        text.includes('voucher') || text.includes('promo') || text.includes('deal') ||
        text.includes('offer') || text.includes('sale') || text.includes('percent')) {
        console.log("✅ [KEYWORD] Classified as: Coupon Code");
        return 'Coupon Code';
    }

    // Art keywords
    if (text.includes('art') || text.includes('drawing') || text.includes('digital') ||
        text.includes('painting') || text.includes('illustration') || text.includes('nft') ||
        text.includes('photoshop') || text.includes('graphic')) {
        console.log("✅ [KEYWORD] Classified as: Art");
        return 'Art';
    }

    console.log("✅ [KEYWORD] Classified as: Others");
    return 'Others';
}
