import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FloatingWhatsappCta } from "@/components/marketing/floating-whatsapp-cta";
import { LegalFooter } from "@/components/legal/legal-footer";
import { ShareEazmybizMarketing } from "@/components/marketing/share-eazmybiz";
import { primaryButtonMd, secondarySkyButtonMd } from "@/lib/ui/primary-button";

function IconQuotations(props: { className?: string }) {
  return (
    <svg className={props.className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
      />
    </svg>
  );
}

function IconDispatch(props: { className?: string }) {
  return (
    <svg className={props.className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.25 2.25 0 00-1.227-1.213l-1.26-.504a2.25 2.25 0 00-2.265.376l-.656.493a2.25 2.25 0 00-.94 1.87v2.625M18 18v-3.375A2.25 2.25 0 0015.75 12H14.25M18 18h1.5m-1.5 0h-1.5m1.5 0v-3.375A2.25 2.25 0 0018 12h1.5m0 0V9.375A2.25 2.25 0 0015 7.125H14.25M14.25 9.375v3m0 0v3m0-3h3m-3 0h-3"
      />
    </svg>
  );
}

function IconReception(props: { className?: string }) {
  return (
    <svg className={props.className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.375 3.375 0 016.338 0z"
      />
    </svg>
  );
}

function IconSparkles(props: { className?: string }) {
  return (
    <svg className={props.className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
      />
    </svg>
  );
}

function IconTable(props: { className?: string }) {
  return (
    <svg className={props.className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125V3.375m17.25 16.5v-9.75m0 9.75a1.125 1.125 0 001.125-1.125M3.375 16.5h15.375m-15.375 0a1.125 1.125 0 01-1.125-1.125V3.375M20.625 6.75H3.375m16.5 0v9.75m0-9.75a1.125 1.125 0 00-1.125-1.125H4.125a1.125 1.125 0 00-1.125 1.125v9.75"
      />
    </svg>
  );
}

function IconCloud(props: { className?: string }) {
  return (
    <svg className={props.className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 15a4.5 4.5 0 004.5-4.5V6a7.5 7.5 0 0110.364 5.548m-9.42 6.852a4.5 4.5 0 117.072 0l-.548.547A3.75 3.75 0 0114.25 21H9.75a3.75 3.75 0 01-2.652-1.093l-.548-.547a4.5 4.5 0 00-7.072 0z"
      />
    </svg>
  );
}

function IconBuilding(props: { className?: string }) {
  return (
    <svg className={props.className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12M3 9h12M3 15h12"
      />
    </svg>
  );
}

function BrandMark({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-3 sm:gap-4 ${className ?? ""}`}>
      <Image
        src="/brand/eazmybiz-mark-infinity.png"
        alt=""
        width={48}
        height={48}
        className="h-10 w-10 shrink-0 object-contain sm:h-12 sm:w-12"
        priority
      />
      <Image
        src="/brand/eazmybiz-wordmark.png"
        alt="eazmybiz"
        width={200}
        height={48}
        className="h-9 w-auto max-w-[min(200px,52vw)] object-contain object-left sm:h-10 sm:max-w-[220px]"
        priority
      />
    </span>
  );
}

const cardBase =
  "rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm shadow-slate-900/5 transition-shadow duration-200 hover:shadow-md dark:shadow-black/20";

const divider = (
  <span className="hidden px-1 text-sm text-[var(--muted)] sm:inline" aria-hidden>
    |
  </span>
);

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden bg-[var(--background)] text-[var(--foreground)]">
      <div
        className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-b from-sky-100/50 via-[var(--background)] to-[var(--background)] dark:from-sky-950/50 dark:via-[var(--background)] dark:to-[var(--background)]"
        aria-hidden
      />
      <div
        className="pointer-events-none fixed left-1/2 top-[-12rem] -z-10 h-[28rem] w-[min(56rem,140vw)] -translate-x-1/2 rounded-full bg-sky-400/25 blur-3xl dark:bg-sky-500/15"
        aria-hidden
      />
      <div
        className="pointer-events-none fixed bottom-[-8rem] right-[-4rem] -z-10 h-[22rem] w-[22rem] rounded-full bg-sky-300/20 blur-3xl dark:bg-sky-600/10"
        aria-hidden
      />

      <header className="sticky top-0 z-50 border-b border-[var(--border)]/80 bg-[var(--background)]/75 backdrop-blur-md dark:bg-[var(--background)]/80">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:py-3.5">
          <Link href="/" className="flex min-w-0 items-center gap-2 rounded-lg outline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-600">
            <BrandMark className="min-w-0" />
          </Link>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:gap-2.5">
            <Link href="/pricing" className={secondarySkyButtonMd}>
              Pricing
            </Link>
            <ShareEazmybizMarketing />
            <Link href="/login" className={secondarySkyButtonMd}>
              Login
            </Link>
            <Link href="/signup" className={`${primaryButtonMd} inline-flex justify-center`}>
              Start for Free
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-10 sm:pb-20 sm:pt-14">
        <section className="text-center">
          <p className="mx-auto inline-flex items-center gap-2 rounded-full border border-sky-500/25 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-800 dark:text-sky-200">
            Cloud documentation for growing businesses
          </p>
          <h1 className="mx-auto mt-6 max-w-3xl text-balance text-3xl font-semibold leading-tight tracking-tight sm:text-4xl sm:leading-tight md:text-5xl md:leading-[1.1]">
            Simplify Your Everyday Business Documentation.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-relaxed text-[var(--muted)] sm:text-lg">
            Say goodbye to messy spreadsheets and lost paperwork. Create, manage, and store your essential business
            documents securely online—so you can focus on growing your business, not chasing paper.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
            <Link href="/login" className={`${secondarySkyButtonMd} min-w-[7.5rem] justify-center`}>
              Login
            </Link>
            {divider}
            <Link href="/signup" className={`${primaryButtonMd} inline-flex min-w-[7.5rem] justify-center`}>
              Start for Free
            </Link>
          </div>
        </section>

        <section className="mt-12 md:mt-14">
          <div className={`${cardBase} border-sky-500/20 bg-gradient-to-br from-[var(--card)] to-sky-500/[0.06] p-8 sm:p-10`}>
            <p className="text-lg font-semibold leading-snug sm:text-xl">
              Running a business is hard enough. Paperwork shouldn&apos;t be.
            </p>
            <p className="mt-4 text-sm leading-relaxed text-[var(--muted)] sm:text-base">
              For small and medium enterprises, managing daily operations often means getting buried in endless Excel
              sheets, manual data entry, and physical files. Whether you are finalizing a big sale, dispatching goods
              from the warehouse, or managing daily visitors, documentation can quickly become a disorganized headache.
            </p>
            <p className="mt-4 text-sm leading-relaxed text-[var(--muted)] sm:text-base">
              eazmybiz is your digital helping hand. We&apos;ve built a simple, cloud-based platform designed
              specifically to take the friction out of your back-office tasks.
            </p>
          </div>
        </section>

        <section className="mt-12 md:mt-14">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Everything Your Team Needs, In One Place
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[var(--muted)] sm:text-base">
              No matter your role in the company, eazmybiz makes your workday smoother.
            </p>
          </div>
          <ul className="mt-6 grid gap-5 md:mt-8 md:grid-cols-3 md:gap-6">
            <li className={cardBase}>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400">
                <IconQuotations className="h-6 w-6" />
              </div>
              <p className="mt-4 font-semibold text-[var(--foreground)]">For the Sales Team</p>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                Create professional, accurate Quotations in minutes to impress your clients and close deals faster.
              </p>
            </li>
            <li className={cardBase}>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400">
                <IconDispatch className="h-6 w-6" />
              </div>
              <p className="mt-4 font-semibold text-[var(--foreground)]">For the Store &amp; Dispatch Team</p>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                Generate clear Packing Lists and Delivery Challans instantly, ensuring your dispatch process is
                accurate and stress-free.
              </p>
            </li>
            <li className={cardBase}>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400">
                <IconReception className="h-6 w-6" />
              </div>
              <p className="mt-4 font-semibold text-[var(--foreground)]">For Admin &amp; Reception</p>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                Easily create and track Visitor Passes and Gate Passes, keeping your premises secure and your records
                perfectly organized.
              </p>
            </li>
          </ul>
        </section>

        <section className="mt-12 md:mt-14">
          <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">Why Switch to eazmybiz?</h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 sm:mt-8 sm:gap-5">
            <li className={`${cardBase} flex gap-4`}>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-400">
                <IconSparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-[var(--foreground)]">Zero Tech Skills Required</p>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted)]">
                  We built this for everyday use. The interface is clean, straightforward, and easy for anyone to
                  learn—from the business owner to the receptionist.
                </p>
              </div>
            </li>
            <li className={`${cardBase} flex gap-4`}>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-400">
                <IconTable className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-[var(--foreground)]">No More Excel Juggling</p>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted)]">
                  Stop searching through old files or worrying about broken formulas. Your document templates are ready
                  to go.
                </p>
              </div>
            </li>
            <li className={`${cardBase} flex gap-4`}>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-400">
                <IconCloud className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-[var(--foreground)]">Organized on the Cloud</p>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted)]">
                  Every document you create is automatically saved and sorted online. Access your records anytime,
                  from anywhere, without worrying about losing a physical file.
                </p>
              </div>
            </li>
            <li className={`${cardBase} flex gap-4`}>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-400">
                <IconBuilding className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-[var(--foreground)]">Built for B2B</p>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted)]">
                  Designed with the exact needs of wholesalers, distributors, and service providers in mind. We provide
                  the structure you need to keep operations moving efficiently.
                </p>
              </div>
            </li>
          </ul>
        </section>

        <section className="mt-12 md:mt-14">
          <div
            className={`${cardBase} relative overflow-hidden border-sky-500/25 bg-gradient-to-br from-sky-600/[0.08] via-[var(--card)] to-[var(--card)] px-6 py-12 text-center dark:from-sky-500/15 sm:px-10 sm:py-14`}
          >
            <div className="pointer-events-none absolute -right-16 top-1/2 h-48 w-48 -translate-y-1/2 rounded-full bg-sky-400/30 blur-2xl dark:bg-sky-500/20" aria-hidden />
            <h2 className="relative text-2xl font-semibold tracking-tight sm:text-3xl">
              Ready to bring order to your back office?
            </h2>
            <p className="relative mx-auto mt-4 max-w-xl text-sm leading-relaxed text-[var(--muted)] sm:text-base">
              Join the businesses that are saving hours every week by making the switch to smart, simple documentation.
            </p>
            <div className="relative mt-8 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
              <Link href="/login" className={`${secondarySkyButtonMd} min-w-[12rem] justify-center bg-[var(--card)]/80 dark:bg-[var(--card)]/50`}>
                Login to Your Dashboard
              </Link>
              {divider}
              <Link href="/signup" className={`${primaryButtonMd} inline-flex min-w-[12rem] justify-center`}>
                Create Your Account
              </Link>
            </div>
          </div>
        </section>
      </main>
      <LegalFooter showOperator showPwaBanner className="mt-auto border-t border-[var(--border)]/80 bg-[var(--background)]/90" />
      <FloatingWhatsappCta />
    </div>
  );
}
