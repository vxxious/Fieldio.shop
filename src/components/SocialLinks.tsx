import { InstagramIcon, TikTokIcon, XIcon } from "./Icons";

const socials = [
  { name: "Instagram", href: "https://www.instagram.com/fieldio_wrd/", Icon: InstagramIcon },
  { name: "TikTok", href: "https://www.tiktok.com/@fieldio_wrd", Icon: TikTokIcon },
  { name: "X", href: "https://x.com/fieldiowrd", Icon: XIcon }
] as const;

export function SocialLinks({ compact = false, onClick }: { compact?: boolean; onClick?: () => void }) {
  return <div className={`social-links${compact ? " social-links--compact" : ""}`}>
    {socials.map(({ name, href, Icon }) => <a key={name} href={href} target="_blank" rel="noopener noreferrer" onClick={onClick} aria-label={`Fieldio on ${name}`}><Icon /><span className={compact ? "sr-only" : undefined}>{name}</span></a>)}
  </div>;
}
