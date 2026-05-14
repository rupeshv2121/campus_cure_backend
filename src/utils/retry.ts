interface RetryOptions {
  maxRetries?: number;
  delayMs?: number;
  exponentialBackoff?: boolean;
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const { maxRetries = 3, delayMs = 1000, exponentialBackoff = true } = options;

  let lastError: Error;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      // Check if it's a timeout error worth retrying
      const isTimeoutError =
        error instanceof Error &&
        (error.message.includes("ETIMEDOUT") ||
          error.message.includes("timeout") ||
          error.message.includes("ECONNREFUSED"));

      if (!isTimeoutError || attempt === maxRetries - 1) {
        throw error;
      }

      // Calculate delay with optional exponential backoff
      const delay = exponentialBackoff
        ? delayMs * Math.pow(2, attempt)
        : delayMs;

      console.log(
        `Database operation failed (attempt ${attempt + 1}/${maxRetries}). Retrying in ${delay}ms...`,
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}
