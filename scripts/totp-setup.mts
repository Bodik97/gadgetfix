// Одноразові коди для входу в адмінку: створює секрет і показує QR-код для додатка.
//
// Запускайте у СВОЄМУ терміналі (не через чат з Claude): секрет — як пароль.
//   npx tsx scripts/totp-setup.mts Богдан
//
// Далі:
//  1. Відскануйте QR у Google Authenticator / 1Password / Authy.
//  2. Додайте рядок у .env.local і ту саму змінну у Vercel → Settings → Environment Variables:
//       ADMIN_TOTP_SECRET=…      — для першого акаунта (ADMIN_EMAIL, власник)
//       ADMIN_TOTP_SECRET_2=…    — для другого (ADMIN_EMAIL_2)
//  3. Redeploy. Відтепер після пароля адмінка питає 6 цифр із додатка.
import QRCode from "qrcode";
import { newTotpSecret, otpauthUrl } from "../src/lib/totp";

const label = process.argv[2]?.trim() || "майстер";
const secret = newTotpSecret();
const url = otpauthUrl(secret, label);

console.log(await QRCode.toString(url, { type: "terminal", small: true }));
console.log(`Для: ${label}`);
console.log(`Секрет (якщо QR не сканується — введіть вручну): ${secret}`);
console.log("\nЗбережіть секрет у змінну ADMIN_TOTP_SECRET (власник) або ADMIN_TOTP_SECRET_2 (другий майстер).");
