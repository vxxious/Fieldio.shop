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

export function TikTokIcon(props: IconProps) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><path fill="currentColor" d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" /></svg>;
}

export function XIcon(props: IconProps) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><path fill="currentColor" d="M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z" /></svg>;
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

export function StoreIcon(props: IconProps) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><path {...base} d="M4 10v10h16V10M3 10l2-6h14l2 6" /><path {...base} d="M3 10a3 3 0 0 0 5 2 3 3 0 0 0 4 0 3 3 0 0 0 4 0 3 3 0 0 0 5-2M9 20v-5h6v5" /></svg>;
}

export function ImageIcon(props: IconProps) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><rect {...base} x="3.5" y="4" width="17" height="16" /><circle {...base} cx="9" cy="9" r="1.5" /><path {...base} d="m5 18 5-5 3 3 2-2 4 4" /></svg>;
}

export function CheckSealIcon(props: IconProps) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><path {...base} d="m12 2 2.2 2 3-.2.7 2.9 2.6 1.5-1.2 2.8 1.2 2.8-2.6 1.5-.7 2.9-3-.2-2.2 2-2.2-2-3 .2-.7-2.9-2.6-1.5L3.5 11 2.3 8.2l2.6-1.5.7-2.9 3 .2L12 2Z" /><path {...base} d="m8.5 11.5 2.2 2.2 4.8-5" /></svg>;
}

export function StarIcon({ fill = "currentColor", ...props }: IconProps) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><path {...base} fill={fill} d="m12 3 2.7 5.5 6 .9-4.4 4.2 1 6-5.3-2.8-5.3 2.8 1-6-4.4-4.2 6-.9L12 3Z" /></svg>;
}
