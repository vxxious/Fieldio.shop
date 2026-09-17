/// <reference types="vite/client" />

interface Window {
  google?: {
    accounts: {
      id: {
        initialize(config: {
          client_id: string;
          callback: (response: { credential?: string }) => void;
          use_fedcm_for_prompt?: boolean;
        }): void;
        renderButton(parent: HTMLElement, options: {
          type: "standard";
          theme: "outline";
          size: "large";
          text: "continue_with";
          shape: "rectangular";
          width: number;
        }): void;
      };
    };
  };
}
