/**
 * AI Model Selection Utility
 * Chooses the best OpenAI model based on token requirements
 */

export function chooseModel(estimatedTokens: number): string {
  // For large analysis tasks, use GPT-4o
  if (estimatedTokens > 2000) {
    return 'gpt-4o';
  }
  
  // For medium tasks, use GPT-4o-mini
  if (estimatedTokens > 500) {
    return 'gpt-4o-mini';
  }
  
  // For small tasks, use GPT-4o-mini (fast and cost-effective)
  return 'gpt-4o-mini';
}

export function getMaxTokensForModel(model: string): number {
  switch (model) {
    case 'gpt-4o':
      return 4096;
    case 'gpt-4o-mini':
      return 2048;
    default:
      return 2048;
  }
} 