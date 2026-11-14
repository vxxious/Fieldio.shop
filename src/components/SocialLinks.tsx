import { ArrowIcon, InstagramIcon, TikTokIcon, XIcon } from "./Icons";

const socials = [
  { name: "Instagram", handle: "@fieldio_wrd", href: "https://www.instagram.com/fieldio_wrd/", Icon: InstagramIcon },
  { name: "TikTok", handle: "@fieldio_wrd", href: "https://www.tiktok.com/@fieldio_wrd", Icon: TikTokIcon },
  { name: "X", handle: "@fieldiowrd", href: "https://x.com/fieldiowrd", Icon: XIcon }
] as const;

export function SocialLinks({ compact = false, onClick }: { compact?: boolean; onClick?: () => void }) {
  return <div className={`social-links${compact ? " social-links--compact" : ""}`}>
    {socials.map(({ name, handle, href, Icon }) => (
      <a key={name} href={href} target="_blank" rel="noopener noreferrer" onClick={onClick} aria-label={`Fieldio on ${name}`}>
        <Icon />
        <span className={compact ? "sr-only" : "social-links-name"}>{name}</span>
        {!compact && <><span className="social-links-handle">{handle}</span><ArrowIcon className="social-links-arrow" /></>}
      </a>
    ))}
  </div>;
}
