import Image from "next/image";
// The original logo files stay at the repository root (see AGENTS.md section 2).
import logoForDarkTheme from "../../../elevate_logo_for_dark_theme.svg";
import logoForLightTheme from "../../../elevate_logo_for_light_theme.svg";

type LogoProps = {
  /** Rendered width in CSS pixels; height follows the 1113x316 aspect ratio. */
  width?: number;
  priority?: boolean;
};

/** Elevate logo that switches with the active light/dark theme. */
export function Logo({ width = 180, priority = false }: LogoProps) {
  const height = Math.round((width * 316) / 1113);
  return (
    <>
      <Image
        src={logoForLightTheme}
        alt="Elevate"
        width={width}
        height={height}
        priority={priority}
        className="logo-for-light"
      />
      <Image
        src={logoForDarkTheme}
        alt="Elevate"
        width={width}
        height={height}
        priority={priority}
        className="logo-for-dark"
      />
    </>
  );
}
