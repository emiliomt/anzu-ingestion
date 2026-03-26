import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "linear-gradient(135deg, #0C1B3A 0%, #1E3A5F 100%)" }}
    >
      <SignIn routing="path" path="/sign-in" />
    </div>
  );
}
