import { Suspense } from "react";
import { AuthPage } from "@/components/AuthPage";

export default function Page() {
  return (
    <Suspense>
      <AuthPage mode="signup" />
    </Suspense>
  );
}
