import { Theme } from "@radix-ui/themes";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { useTheme } from "./ThemeContext";
import { ReactNode } from "react";

export function ThemeWrapper({ children }: { children: ReactNode }) {
  const { appearance, accentColor } = useTheme();

  return (
    <TooltipPrimitive.Provider delayDuration={300}>
      <Theme appearance={appearance} accentColor={accentColor} radius="medium">
        {children}
      </Theme>
    </TooltipPrimitive.Provider>
  );
}
