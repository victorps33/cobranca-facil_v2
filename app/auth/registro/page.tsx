import { Suspense } from "react";
import { RegistroForm } from "./registro-form";

export default function RegistroPage() {
  const googleEnabled = !!(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  );

  return (
    <Suspense>
      <RegistroForm googleEnabled={googleEnabled} />
    </Suspense>
  );
}
