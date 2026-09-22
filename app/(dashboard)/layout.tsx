import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { Button } from "@/components/ui/button";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/70 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <nav className="flex items-center gap-8">
            <Link
              href="/"
              className="font-heading text-lg font-medium tracking-tight text-foreground"
            >
              Money<span className="text-accent">More</span>
            </Link>
            <Link
              href="/loans/new"
              className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase transition-colors hover:text-foreground"
            >
              ปล่อยกู้ใหม่
            </Link>
            <Link
              href="/loans"
              className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase transition-colors hover:text-foreground"
            >
              สัญญาที่มีอยู่
            </Link>
            <Link
              href="/calendar"
              className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase transition-colors hover:text-foreground"
            >
              ปฏิทิน
            </Link>
            <Link
              href="/history"
              className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase transition-colors hover:text-foreground"
            >
              ประวัติ
            </Link>
          </nav>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <Button
              variant="ghost"
              size="sm"
              type="submit"
              className="text-xs tracking-[0.1em] text-muted-foreground uppercase"
            >
              ออกจากระบบ
            </Button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
    </div>
  );
}
