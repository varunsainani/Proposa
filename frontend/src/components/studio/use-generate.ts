"use client";

import { useEffect, useState } from "react";

/**
 * Drives the multi-step "AI is working" copy. While `active` is true it cycles
 * through the three pipeline steps (gather -> match -> write), pausing on the
 * last one until the real request resolves. Returns the current step index.
 */
export function useWorkingStep(active: boolean, stepCount = 3): number {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!active) {
      setStep(0);
      return;
    }
    setStep(0);
    const id = setInterval(() => {
      // Advance, but hold on the final step until the request finishes.
      setStep((s) => Math.min(s + 1, stepCount - 1));
    }, 1100);
    return () => clearInterval(id);
  }, [active, stepCount]);

  return step;
}
