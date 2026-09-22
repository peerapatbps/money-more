import { NewLoanForm } from "./new-loan-form";

export default function NewLoanPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">ปล่อยกู้ใหม่</h1>
      <NewLoanForm />
    </div>
  );
}
