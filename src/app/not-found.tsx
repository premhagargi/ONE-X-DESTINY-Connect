import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center px-5 text-center">
      <h1 className="font-display text-3xl text-ink">That room doesn&apos;t exist</h1>
      <p className="mt-3 text-mist">
        It may have been closed, or the link might be off.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-full bg-harbor px-5 py-2.5 text-sm font-medium text-white hover:bg-harbor-dark"
      >
        See open rooms
      </Link>
    </main>
  );
}
