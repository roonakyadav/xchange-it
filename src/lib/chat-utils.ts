/**
 * Generate a consistent chat ID for a buyer-seller-post combination
 */
export function generateChatId(buyerId: string, sellerId: string, postId: string): string {
    // Sort buyer and seller IDs to ensure consistent chat ID regardless of who initiates
    const [user1, user2] = [buyerId, sellerId].sort()
    return `${user1}-${user2}-${postId}`
}

/**
 * Parse chat ID to extract buyer, seller, and post IDs
 */
export function parseChatId(chatId: string): { buyerId: string; sellerId: string; postId: string } | null {
    const parts = chatId.split('-')
    if (parts.length !== 3) return null

    const [user1, user2, postId] = parts
    // We can't determine which is buyer/seller from the ID alone
    // This would need to be determined from the database
    return { buyerId: user1, sellerId: user2, postId }
}
