"use client";

import { useBooking } from "./BookingModal";

type Props = {
  /** Назва послуги — саме та, що в services.ts */
  service?: string;
  model?: string;
  className?: string;
  children: React.ReactNode;
};

/**
 * «Записатись» із пам'яттю про вибір: відкриває вікно запису на місці,
 * з уже підставленою послугою чи моделлю — без переходу й прокрутки.
 */
export default function BookLink({ service, model, className, children }: Props) {
  const openBooking = useBooking();

  return (
    <button
      type="button"
      className={className}
      data-track="book-link"
      onClick={() => openBooking({ service, model })}
    >
      {children}
    </button>
  );
}
