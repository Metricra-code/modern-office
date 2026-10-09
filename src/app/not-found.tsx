import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="not-found">
      <p className="eyebrow">A LITTLE DETOUR</p>
      <h1>This corner is still uncharted.</h1>
      <p>The office is right this way.</p>
      <Link href="/" className="primary-button">
        Back to the office →
      </Link>
    </main>
  );
}
