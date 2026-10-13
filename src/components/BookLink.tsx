"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useBooking } from "./BookingModal";

type Props = {
  /** Назва послуги — саме та, що в services.ts */
  service?: string;
  model?: string;
  className?: string;
  children: React.ReactNode;
};

/**
 * «Записатись» із пам'яттю про вибір.
 *
 * Залогіненому клієнту ведемо на його сторінку: контакти там уже є, і обрана
 * послуга одразу підставиться у форму — лишиться натиснути «Замовити».
 * Решті — до форми запису на цій же сторінці, теж із підставленим вибором.
 * Де форми на сторінці немає (сторінка послуги) — відкриваємо вікно запису.
 */
export default function BookLink({ service, model, className, children }: Props) {
  const { isSignedIn } = useUser();
  const pathname = usePathname();
  const openBooking = useBooking();

  const params = new URLSearchParams();
  if (service) params.set("service", service);
  if (model) params.set("model", model);
  const query = params.toString();

  const href = isSignedIn
    ? `/moi-remonty${query ? `?${query}` : ""}`
    : `${pathname}${query ? `?${query}` : ""}#book`;

  return (
    <Link
      href={href}
      className={className}
      scroll={!isSignedIn}
      data-track="book-link"
      onClick={(e) => {
        // Перевіряємо в момент кліку: чи є форма на сторінці, знає лише браузер.
        // Поки Clerk вантажиться, isSignedIn ще немає — тоді теж вікно запису,
        // а не посилання на якір, якого на сторінці не існує
        if (isSignedIn || document.getElementById("book")) return;
        e.preventDefault();
        openBooking({ service, model });
      }}
    >
      {children}
    </Link>
  );
}
