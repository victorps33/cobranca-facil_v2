"use client";

import { cn } from "@/lib/cn";
import { Check } from "lucide-react";

interface Step {
  id: number;
  name: string;
  description?: string;
}

interface StepperProps {
  steps: Step[];
  currentStep: number;
  onStepClick?: (step: number) => void;
  allCompleted?: boolean;
}

export function Stepper({ steps, currentStep, onStepClick, allCompleted }: StepperProps) {
  return (
    <nav aria-label="Progress" className="w-full">
      <ol className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = allCompleted || currentStep > step.id;
          const isCurrent = !allCompleted && currentStep === step.id;
          const isClickable = onStepClick && (isCompleted || isCurrent);

          return (
            <li key={step.id} className="relative flex-1">
              {/* Connector line */}
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "absolute top-5 left-[calc(50%+24px)] right-[calc(-50%+24px)] h-0.5",
                    isCompleted ? "bg-primary" : "bg-gray-200"
                  )}
                />
              )}

              {/* Step */}
              <div className="flex flex-col items-center">
                <button
                  onClick={() => isClickable && onStepClick?.(step.id)}
                  disabled={!isClickable}
                  className={cn(
                    "relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors",
                    isCompleted
                      ? "border-primary bg-primary text-white"
                      : isCurrent
                      ? "border-secondary bg-secondary/10 text-secondary"
                      : "border-gray-300 bg-white text-gray-400",
                    isClickable && "cursor-pointer hover:shadow-md"
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <span className="text-sm font-semibold">{step.id}</span>
                  )}
                </button>

                <div className="mt-2 text-center">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      isCurrent || isCompleted ? "text-gray-900" : "text-gray-500"
                    )}
                  >
                    {step.name}
                  </p>
                  {step.description && (
                    <p className="text-xs text-gray-400 mt-0.5 hidden sm:block">
                      {step.description}
                    </p>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
