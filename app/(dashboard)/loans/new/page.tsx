import { NewLoanForm } from "./new-loan-form";

export default function NewLoanPage() {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-heading text-2xl font-medium tracking-tight text-foreground">
        ปล่อยกู้ใหม่
      </h1>
      <NewLoanForm />
    </div>
  );
}
