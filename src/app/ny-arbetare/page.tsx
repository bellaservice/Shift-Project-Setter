import { BackButton } from "@/components/BackButton";
import { NyArbetareForm } from "./NyArbetareForm";

export default function NyArbetarePage() {
  return (
    <div className="flex flex-col gap-4">
      <BackButton />
      <h1 className="text-xl font-semibold">Ny Arbetare</h1>
      <NyArbetareForm />
    </div>
  );
}
