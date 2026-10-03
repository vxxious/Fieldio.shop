import { GoogleIcon } from "./Icons";

type Props = {
  disabled?: boolean;
  label: string;
  onClick: () => void;
};

export function GoogleSignInButton({ disabled = false, label, onClick }: Props) {
  return <button className="google-signin-button" type="button" disabled={disabled} onClick={onClick}><GoogleIcon data-preserve-color />{label}</button>;
}
