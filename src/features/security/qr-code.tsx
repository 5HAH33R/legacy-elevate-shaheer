import { qrPath } from "@/lib/qr";

/** Locally drawn QR. Dark modules on a white tile so phones scan in dark mode. */
export function QrCode({ value, label }: { value: string; label: string }) {
  const { size, d } = qrPath(value);
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      className="h-52 w-52 rounded-md border border-control bg-white"
    >
      <rect width={size} height={size} fill="#ffffff" />
      <path d={d} fill="#000000" />
    </svg>
  );
}
