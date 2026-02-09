import { LoginForm } from "./login-form";

export default function LoginPage() {
  const googleEnabled = !!(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  );

  return <LoginForm googleEnabled={googleEnabled} />;
}
