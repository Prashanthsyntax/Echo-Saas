/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";

export function Greeting() {
  const { user } = useUser();
  const [greeting, setGreeting] = useState("Good morning");

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good morning");
    else if (hour < 17) setGreeting("Good afternoon");
    else setGreeting("Good evening");
  }, []);

  const firstName = user?.firstName;

  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold text-white">
        {greeting}
        {firstName && (
          <span className="text-white/60">, {firstName}</span>
        )}
      </h1>
      <p className="mt-1 text-sm text-white/30">
        Here&apos;s what&apos;s happening with your Echo workspace today
      </p>
    </div>
  );
}