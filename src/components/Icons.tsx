import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export function MenuIcon(props: IconProps) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><path {...base} strokeWidth="1.85" d="M3.5 6.5h17M3.5 12h17M3.5 17.5h17" /></svg>;
}

export function CloseIcon(props: IconProps) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><path {...base} d="m5 5 14 14M19 5 5 19" /></svg>;
}

export function SearchIcon(props: IconProps) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><circle {...base} cx="10.8" cy="10.8" r="6.3" /><path {...base} d="m15.5 15.5 4 4" /></svg>;
}

export function BagIcon(props: IconProps) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><path {...base} d="M5 8.5h14l-1 11H6l-1-11Z" /><path {...base} d="M9 9V6.5a3 3 0 0 1 6 0V9" /></svg>;
}

export function AccountIcon(props: IconProps) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><circle {...base} cx="12" cy="7.5" r="3.5" /><path {...base} d="M5.5 20v-1.5a6.5 6.5 0 0 1 13 0V20" /></svg>;
}

export function HeartIcon({ fill = "none", ...props }: IconProps) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><path {...base} fill={fill} d="M20.5 9.1c0 5-8.5 10-8.5 10s-8.5-5-8.5-10A4.6 4.6 0 0 1 12 6.6a4.6 4.6 0 0 1 8.5 2.5Z" /></svg>;
}

export function ArrowIcon(props: IconProps) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><path {...base} d="M4 12h15M14 7l5 5-5 5" /></svg>;
}

export function ArrowUpIcon(props: IconProps) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><path {...base} d="M12 19V5M6.5 10.5 12 5l5.5 5.5" /></svg>;
}

export function PlusIcon(props: IconProps) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><path {...base} d="M12 5v14M5 12h14" /></svg>;
}

export function MinusIcon(props: IconProps) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><path {...base} d="M5 12h14" /></svg>;
}

export function ChevronIcon(props: IconProps) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><path {...base} d="m8 10 4 4 4-4" /></svg>;
}

export function InstagramIcon(props: IconProps) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><rect {...base} x="3.5" y="3.5" width="17" height="17" rx="4" /><circle {...base} cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.7" r="1" fill="currentColor" /></svg>;
}

export function GoogleIcon(props: IconProps) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
    <path fill="#4285f4" d="M21.6 12.23c0-.71-.06-1.4-.19-2.07H12v3.91h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.4Z" />
    <path fill="#34a853" d="M12 22c2.7 0 4.98-.9 6.62-2.37l-3.24-2.54c-.9.6-2.05.96-3.38.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z" />
    <path fill="#fbbc05" d="M6.39 13.92A6 6 0 0 1 6.08 12c0-.67.11-1.32.31-1.92V7.46H3.04A10 10 0 0 0 2 12c0 1.61.39 3.14 1.04 4.54l3.35-2.62Z" />
    <path fill="#ea4335" d="M12 5.95c1.47 0 2.79.51 3.83 1.5l2.87-2.87A9.64 9.64 0 0 0 12 2a10 10 0 0 0-8.96 5.46l3.35 2.62C7.18 7.71 9.39 5.95 12 5.95Z" />
  </svg>;
}

export function EmailIcon(props: IconProps) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><rect {...base} x="3.5" y="5.5" width="17" height="13" /><path {...base} d="m4.5 7 7.5 6 7.5-6" /></svg>;
}

export function EyeIcon({ open = false, ...props }: IconProps & { open?: boolean }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
    <path {...base} d="M2.8 12s3.3-6 9.2-6 9.2 6 9.2 6-3.3 6-9.2 6-9.2-6-9.2-6Z" />
    <circle {...base} cx="12" cy="12" r="2.6" />
    {!open && <path {...base} d="m4 4 16 16" />}
  </svg>;
}

export function ThemeDiscIcon(props: IconProps) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
    <defs><clipPath id="fieldio-theme-disc"><circle cx="12" cy="12" r="8.25" /></clipPath></defs>
    <circle cx="12" cy="12" r="8.25" fill="none" stroke="currentColor" strokeWidth="1.55" />
    <path d="M12 3.75a8.25 8.25 0 0 1 0 16.5Z" fill="currentColor" />
    <g clipPath="url(#fieldio-theme-disc)" fill="none" stroke="currentColor" strokeWidth="1.15">
      <path d="m3 8 6-6M2.5 13 12 3.5M3.5 17 12 8.5M7 20 12 15" />
    </g>
    <path d="M12 3.75v16.5" fill="none" stroke="currentColor" strokeWidth="1.25" />
  </svg>;
}
