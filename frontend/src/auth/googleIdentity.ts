/** Kiểu tối thiểu của Google Identity Services (https://developers.google.com/identity/gsi/web/reference/js-reference) */
interface GsiButtonOptions {
  type?: 'standard' | 'icon';
  theme?: 'outline' | 'filled_blue' | 'filled_black';
  size?: 'large' | 'medium' | 'small';
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
  shape?: 'rectangular' | 'pill';
  logo_alignment?: 'left' | 'center';
  width?: number;
  locale?: string;
}

interface GoogleAccountsId {
  initialize: (options: { client_id: string; callback: (res: { credential: string }) => void; ux_mode?: 'popup' }) => void;
  renderButton: (parent: HTMLElement, options: GsiButtonOptions) => void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleAccountsId } };
  }
}

const GSI_SRC = 'https://accounts.google.com/gsi/client';
let loading: Promise<GoogleAccountsId> | null = null;

/** Tải script GSI một lần, chỉ khi có trang cần nút Google */
export function loadGoogleIdentity(): Promise<GoogleAccountsId> {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id);
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = GSI_SRC;
      script.async = true;
      script.onload = () => (window.google?.accounts?.id ? resolve(window.google.accounts.id) : reject(new Error('GSI not available')));
      script.onerror = () => {
        loading = null; // cho phép thử lại lần sau
        script.remove();
        reject(new Error('Không tải được Google Sign-In'));
      };
      document.head.appendChild(script);
    });
  }
  return loading;
}
