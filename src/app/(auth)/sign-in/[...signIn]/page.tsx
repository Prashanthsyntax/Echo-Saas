import { SignIn } from "@clerk/nextjs";

export default function SignInCatchAllPage() {
  return (
    <SignIn
      routing="path"
      path="/sign-in"
      signUpUrl="/sign-up"
      fallbackRedirectUrl="/overview"
    />
  );
}
