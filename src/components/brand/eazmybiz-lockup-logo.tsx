import Image from "next/image";
import Link from "next/link";

/** Full lockup (mark + wordmark) for auth and marketing surfaces. */
export function EazmybizLockupLogo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`mx-auto block w-fit self-center outline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-600 ${className ?? ""}`}
    >
      <Image
        src="/brand/eazmybiz-lockup.png"
        alt="eazmybiz"
        width={360}
        height={92}
        className="h-14 w-auto max-w-full object-contain object-center sm:h-16"
        priority
      />
    </Link>
  );
}
