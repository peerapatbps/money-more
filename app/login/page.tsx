import { signIn } from "@/auth";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50">
      <div className="w-full max-w-sm rounded-xl border bg-white p-8 text-center shadow-sm">
        <h1 className="mb-1 text-2xl font-semibold">MoneyMore</h1>
        <p className="mb-6 text-sm text-neutral-500">ระบบจัดการปล่อยกู้</p>
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
