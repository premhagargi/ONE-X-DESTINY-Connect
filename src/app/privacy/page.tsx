import Link from "next/link";

export const metadata = { title: "Privacy & safety — ONE-X-DESTINY Connect" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-xl px-5 py-12 sm:py-16">
      <Link href="/" className="text-sm font-medium text-mist hover:text-harbor-dark">
        ← All rooms
      </Link>
      <h1 className="mt-4 font-display text-3xl text-ink">Privacy &amp; safety</h1>

      <div className="mt-6 flex flex-col gap-5 text-[15px] leading-relaxed text-ink-soft">
        <p>
          You don&apos;t need an account, an email address, or a phone number to
          use ONE-X-DESTINY Connect. Your nickname is chosen by you and is not tied to any
          identity we verify.
        </p>
        <p>
          <strong className="text-ink">Anonymous to other people isn&apos;t the same as invisible to us.</strong>{" "}
          To keep the chat working and to prevent abuse, the service keeps a
          small amount of technical state: a random session identifier (stored
          in a cookie your browser sends with each request), the messages you
          send, and when they were sent. We do not store your IP address
          alongside your messages.
        </p>
        <p>
          If someone reports abuse, a moderator can see the reported
          message and, if necessary, suspend the session that sent it. We
          cannot promise that content is unrecoverable once sent — a message
          you send is visible to everyone in the room immediately, and
          deleting it later removes it from the room but does not undo the
          fact that it was seen.
        </p>
        <p>
          Messages are kept for a limited time (30 days by default) and then
          permanently removed from our primary database as part of a
          scheduled cleanup. This is a retention policy, not a guarantee
          about infrastructure-level backups some providers may keep for a
          short period for disaster recovery.
        </p>
        <p>
          Nicknames are only unique within a room at a given time — they are
          not a verified identity, and you shouldn&apos;t treat a nickname
          match as proof of who you&apos;re talking to.
        </p>
        <p>Don&apos;t share anything here you wouldn&apos;t want a stranger to read.</p>
      </div>

      <h2 className="mt-10 font-display text-2xl text-ink">Community Guidelines &amp; Compliance</h2>
      <div className="mt-4 flex flex-col gap-4 text-[15px] leading-relaxed text-ink-soft">
        <p>
          To maintain a safe, welcoming, and legally compliant environment for everyone, all participants must abide by these rules:
        </p>
        <ul className="list-disc pl-5 flex flex-col gap-2">
          <li>
            <strong className="text-ink">No harassment or hate speech:</strong> Discrimination, threats, hate speech, bullying, and intimidation based on race, religion, gender, sexual orientation, disability, or nationality are strictly prohibited.
          </li>
          <li>
            <strong className="text-ink">No illicit or harmful content:</strong> Posting sexually explicit material, promoting violence, self-harm, illegal goods, or unlawful conduct results in immediate ban and report escalation.
          </li>
          <li>
            <strong className="text-ink">No scams, phishing, or bot spam:</strong> Bulk advertising, deceptive links, referral schemes, payment fraud, and impersonation of administrators or moderators are blocked.
          </li>
          <li>
            <strong className="text-ink">Protect personal safety &amp; privacy:</strong> Never share sensitive personal data (such as bank details, credit card numbers, home addresses, or private phone numbers) in public rooms.
          </li>
        </ul>
        <p className="mt-2 text-sm text-mist">
          Violations can be flagged using the report button on any message. Moderators actively review reports and immediately revoke session access for bad actors.
        </p>
      </div>
    </main>
  );
}
