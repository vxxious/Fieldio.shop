import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLayoutEffect, useRef } from "react";

gsap.registerPlugin(ScrollTrigger);

export function EditorialText({ text, className = "" }: { text: string; className?: string }) {
  const rootRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const words = root.querySelectorAll<HTMLElement>(".editorial-word");
    const context = gsap.context(() => {
      gsap.fromTo(words,
        { transform: "translateY(112%)" },
        {
          transform: "translateY(0%)",
          duration: 0.72,
          stagger: 0.045,
          ease: "power4.out",
          clearProps: "transform",
          scrollTrigger: { trigger: root, start: "top 88%", once: true }
        }
      );
    }, root);
    return () => context.revert();
  }, [text]);

  return (
    <span ref={rootRef} className={`editorial-text ${className}`.trim()}>
      <span className="sr-only">{text}</span>
      <span className="editorial-text-visual" aria-hidden="true">
        {text.split(/\s+/).map((word, index) => (
          <span className="editorial-word-mask" key={`${word}-${index}`}><span className="editorial-word">{word}</span></span>
        ))}
      </span>
    </span>
  );
}
