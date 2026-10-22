import Image from "next/image";
// The original logo files stay at the repository root (see AGENTS.md section 2).
import logoForDarkTheme from "../../../elevate_logo_for_dark_theme.svg";
import logoForLightTheme from "../../../elevate_logo_for_light_theme.svg";

type LogoProps = {
  /** Rendered width in CSS pixels; height follows the 1113x316 aspect ratio. */
  width?: number;
  priority?: boolean;
  className?: string;
};

/** Elevate logo that switches with the active light/dark theme.
 *
 * `elevate_logo_for_dark_theme.svg` has canvas 1113x316 (ratio 3.52) with artwork filling 100% of bounds.
 * `elevate_logo_for_light_theme.svg` has canvas 1600x800 (ratio 2.0) with artwork occupying 1264x384.
 * Both logos are aligned so their visible artwork bounds and height match across themes.
 */
export function Logo({ width = 180, priority = false, className = "" }: LogoProps) {
  const height = Math.round((width * 316) / 1113);

  // Scaled dimensions so light artwork height (384/800 = 48%) matches dark artwork height (313/316 ≈ 99%)
  const lightHeight = Math.round((height * 800) / 384);
  const lightWidth = Math.round(lightHeight * 2);
  // Shift left to compensate for the 174px transparent left margin of the 1600px light SVG canvas
  const leftShift = Math.round((lightWidth * 174) / 1600);

  return (
    <div
      className={`relative inline-flex items-center justify-start shrink-0 overflow-visible ${className}`}
      style={{ width, height }}
    >
      <Image
        src={logoForDarkTheme}
        alt="Elevate"
        width={width}
        height={height}
        priority={priority}
        className="logo-for-dark h-auto w-full object-contain"
      />
      <div className="logo-for-light absolute inset-0 flex items-center justify-start overflow-visible pointer-events-none">
        <Image
          src={logoForLightTheme}
          alt="Elevate"
          width={lightWidth}
          height={lightHeight}
          priority={priority}
          className="max-w-none h-auto object-contain"
          style={{
            width: `${lightWidth}px`,
            height: `${lightHeight}px`,
            marginLeft: `-${leftShift}px`,
          }}
        />
      </div>
    </div>
  );
}
