/**
 * Runs once when the Next.js server starts. The Node-only work lives in instrumentation-node.ts
 * (database setup, first-start seed, built-in scheduler).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('@/server/boot');
  }
}
