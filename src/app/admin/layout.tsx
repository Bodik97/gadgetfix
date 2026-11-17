import type { Metadata } from "next";
import { getAllReviews } from "@/db/reviews";
import { getCounters } from "@/db/adminStats";
import { countUnreadForMaster } from "@/db/messages";
import { currentAdmin } from "@/lib/admin";
import LiveRefresh from "@/components/LiveRefresh";
import AdminShell from "./AdminShell";
import { signOut } from "./actions";

export const dynamic = "force-dynamic";

/** Адмінку можна додати на головний екран як окремий застосунок */
export const metadata: Metadata = {
  manifest: "/admin/manifest.webmanifest",
  appleWebApp: { capable: true, title: "GadgetFix Адмін", statusBarStyle: "black" },
  icons: { apple: "/admin-icons/icon-180.png" },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Сторінка входу теж лежить під /admin, тож меню показуємо лише тим, хто зайшов
  const master = await currentAdmin();
  if (!master) return <>{children}</>;

  const [counters, reviews, unreadChats] = await Promise.all([
    getCounters(),
    getAllReviews(),
    countUnreadForMaster(),
  ]);
  const pendingReviews = reviews.filter((r) => !r.published).length;

  return (
    <AdminShell
      badges={{
        fresh: counters.fresh + unreadChats,
        toShip: counters.toShip,
        pendingReviews,
        online: counters.online,
      }}
      master={master.name}
      owner={master.role === "owner"}
      actions={<LiveRefresh silent />}
      signOut={signOut}
    >
      {children}
    </AdminShell>
  );
}
