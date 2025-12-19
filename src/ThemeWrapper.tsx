import { Theme } from "@radix-ui/themes";
import { useTheme } from "./ThemeContext";
import { ReactNode } from "react";

export function ThemeWrapper({ children }: { children: ReactNode }) {
  const { appearance, accentColor } = useTheme();

  return (
    <Theme appearance={appearance} accentColor={accentColor} radius="medium">
      {children}
    </Theme>
  );
}
