import { SignUp } from "@clerk/nextjs";

export default function SignUpCatchAllPage() {
  return (
    <SignUp
      routing="path"
      path="/sign-up"
      signInUrl="/sign-in"
      fallbackRedirectUrl="/overview"
    />
  );
}
