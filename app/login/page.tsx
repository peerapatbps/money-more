import { signIn } from "@/auth";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm border border-border/70 bg-card p-10 text-center">
        <p className="mb-3 text-[0.65rem] font-medium tracking-[0.3em] text-accent uppercase">
          ระบบจัดการปล่อยกู้
        </p>
        <h1 className="mb-8 font-heading text-3xl font-medium tracking-tight text-foreground">
          Money<span className="text-accent">More</span>
        </h1>
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
        >
          <Button type="submit" className="w-full">
            เข้าสู่ระบบด้วย Google
          </Button>
        </form>
      </div>
    </div>
  );
}
