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
    else if (hour < 18) setGreeting("Good afternoon");
    else setGreeting("Good evening");
  }, []);

  const name = user?.firstName ?? user?.username ?? "";

  return (
    <div className="mb-8">
      <h1 className="text-3xl font-bold text-white">
        {greeting}{name ? `, ${name}` : ""}
      </h1>
    </div>
  );
}