import { useTheme } from "../hooks/useTheme";
import { ThemeDiscIcon } from "./Icons";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const dark = theme === "dark";
  const label = `Switch to ${dark ? "light" : "dark"} mode`;

  return (
    <button
      type="button"
      className="icon-button theme-toggle"
      aria-label={label}
      aria-pressed={dark}
      title={label}
      onClick={toggleTheme}
    >
      <span className="theme-toggle-icon"><ThemeDiscIcon /></span>
    </button>
  );
}
