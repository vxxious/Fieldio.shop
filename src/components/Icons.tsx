import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export function MenuIcon(props: IconProps) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><path {...base} d="M4 8h16M4 16h16" /></svg>;
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

export function HeartIcon({ fill = "none", ...props }: IconProps) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><path {...base} fill={fill} d="M20.5 9.1c0 5-8.5 10-8.5 10s-8.5-5-8.5-10A4.6 4.6 0 0 1 12 6.6a4.6 4.6 0 0 1 8.5 2.5Z" /></svg>;
}

export function ArrowIcon(props: IconProps) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><path {...base} d="M4 12h15M14 7l5 5-5 5" /></svg>;
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
