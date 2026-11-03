/**
 * Кнопка «Отримувати статус у Telegram»: відкриває бота з особистим
 * посиланням. Після «Start» клієнту приходить повідомлення на кожну зміну
 * етапу ремонту. Посилання будує сервер; без нього кнопки немає.
 */
export default function TelegramConnect({
  href,
  className,
  label = "Отримувати статус у Telegram",
  quiet = false,
}: {
  href: string | null | undefined;
  className?: string;
  /** Коротший підпис там, де кнопка стоїть у ряду з іншими */
  label?: string;
  /** Другорядна дія поруч із головною — без заливки */
  quiet?: boolean;
}) {
  if (!href) return null;

  return (
    <a href={href} target="_blank" rel="noopener" className={`btn ${quiet ? "btn-ghost" : "btn-accent"} ${className ?? ""}`} data-track="tg-connect">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 4L3 11l6 2.5" />
        <path d="M21 4l-3 15-9-5.5" />
        <path d="M9 13.5V19l3.2-3.3" />
        <path d="M9 13.5L21 4" />
      </svg>
      {label}
    </a>
  );
}
