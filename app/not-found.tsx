import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3">
      <div className="h-display text-4xl">404</div>
      <p className="text-gray-400">That page doesn&apos;t exist.</p>
      <Link className="btn-ghost" href="/">Back to the board</Link>
    </main>
  );
}
