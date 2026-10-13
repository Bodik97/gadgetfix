import { describe, expect, it } from "vitest";
import { formatPhone, localDigits, phoneComplete } from "@/components/PhoneInput";

/** Поле телефону: «+38» стоїть завжди, а номер приймається в будь-якому звичному вигляді */
describe("поле телефону", () => {
  it("набір після +38 — цифри номера з нуля", () => {
    expect(localDigits("+38 0")).toBe("0");
    expect(localDigits("+38 073 123 45 67")).toBe("0731234567");
  });

  it("почали без нуля — нуль підставляється", () => {
    expect(localDigits("+38 7")).toBe("07");
    expect(localDigits("+38 731234567")).toBe("0731234567");
  });

  it("вставлений номер у будь-якому вигляді зводиться до одного", () => {
    for (const pasted of ["+380731234567", "380731234567", "0731234567", "+38 +380 73 123-45-67", "073 123 45 67"]) {
      expect(localDigits(pasted)).toBe("0731234567");
    }
  });

  /** Набір по одній цифрі в кінець поля — так, як це робить компонент на кожне натискання */
  const typed = (keys: string) => {
    let value = "";
    for (const key of keys) {
      const local = localDigits(formatPhone(localDigits(value)) + key);
      value = local ? `+38${local}` : "";
    }
    return value;
  };

  it("код країни чи вісімка, набрані вдруге після +38, не потрапляють у номер", () => {
    expect(typed("380731234567")).toBe("+380731234567");
    expect(typed("80731234567")).toBe("+380731234567");
    expect(typed("0731234567")).toBe("+380731234567");
    expect(typed("731234567")).toBe("+380731234567");
    expect(localDigits("+38 +380731234567")).toBe("0731234567");
    expect(localDigits("8 073 123 45 67")).toBe("0731234567");
  });

  it("цифри, набрані перед +38, — теж номер, а не код країни", () => {
    expect(localDigits("0+38 ")).toBe("0");
    expect(localDigits("073+38 1234567")).toBe("0731234567");
  });

  it("зайві цифри відкидаються, залишок стертого префікса — не номер", () => {
    expect(localDigits("+38 073 123 45 67 89")).toBe("0731234567");
    expect(localDigits("+3")).toBe("");
    expect(localDigits("+")).toBe("");
    expect(localDigits("")).toBe("");
  });

  it("показується з пробілами, порожнє — лише +38", () => {
    expect(formatPhone("")).toBe("+38 ");
    expect(formatPhone("073")).toBe("+38 073");
    expect(formatPhone("0731")).toBe("+38 073 1");
    expect(formatPhone("0731234567")).toBe("+38 073 123 45 67");
  });

  it("повний номер — рівно десять цифр після +38", () => {
    expect(phoneComplete("+380731234567")).toBe(true);
    expect(phoneComplete("+38073123456")).toBe(false);
    expect(phoneComplete("")).toBe(false);
  });

  it("десять цифр без справжнього коду оператора — номер не повний", () => {
    expect(phoneComplete("+380380731234")).toBe(false);
    expect(phoneComplete("+380807312345")).toBe(false);
  });
});
