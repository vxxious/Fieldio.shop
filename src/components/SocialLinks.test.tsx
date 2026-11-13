import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { ServicePage } from "../pages/ServicePage";
import { SocialLinks } from "./SocialLinks";

vi.mock("../context/LocaleContext", () => ({ useLocale: () => ({ t: (key: string) => key }) }));
afterEach(cleanup);

it("links to Fieldio's social profiles with accessible brand icons", () => {
  const onClick = vi.fn();
  render(<SocialLinks compact onClick={onClick} />);

  const profiles = [
    ["Instagram", "https://www.instagram.com/fieldio_wrd/"],
    ["TikTok", "https://www.tiktok.com/@fieldio_wrd"],
    ["X", "https://x.com/fieldiowrd"]
  ];
  for (const [name, href] of profiles) {
    const link = screen.getByRole("link", { name: `Fieldio on ${name}` });
    expect(link).toHaveAttribute("href", href);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link.querySelector("svg")).not.toBeNull();
  }
  fireEvent.click(screen.getByRole("link", { name: "Fieldio on TikTok" }));
  expect(onClick).toHaveBeenCalledOnce();
});

it("shows social profiles on Contact without adding them to other enquiry pages", () => {
  render(<MemoryRouter initialEntries={["/contact"]}><ServicePage /></MemoryRouter>);
  expect(screen.getByText("Follow Fieldio for new arrivals and updates")).toBeVisible();
  expect(screen.getByRole("link", { name: "Fieldio on TikTok" })).toBeVisible();
  cleanup();
  render(<MemoryRouter initialEntries={["/wholesale"]}><ServicePage /></MemoryRouter>);
  expect(screen.queryByRole("link", { name: "Fieldio on TikTok" })).toBeNull();
});
