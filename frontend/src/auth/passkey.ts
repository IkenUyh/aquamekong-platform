/**
 * WebAuthn trong trình duyệt: backend gửi tham số với các trường nhị phân dạng base64url,
 * navigator.credentials cần ArrayBuffer; kết quả gửi lại backend theo định dạng JSON chuẩn WebAuthn.
 */

/* eslint-disable @typescript-eslint/no-explicit-any -- JSON tham số do backend (Yubico) sinh, chỉ đổi vài trường */

export const passkeySupported = () =>
  typeof window !== 'undefined' && !!window.PublicKeyCredential && !!navigator.credentials?.create;

function fromBase64Url(value: string): ArrayBuffer {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)).buffer;
}

function toBase64Url(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const descriptors = (list?: any[]) => (list ?? []).map((c) => ({ ...c, id: fromBase64Url(c.id) }));

/** Tạo passkey mới trên thiết bị (vân tay / Face ID / PIN / khoá bảo mật) */
export async function createPasskey(publicKey: any): Promise<object> {
  const credential = (await navigator.credentials.create({
    publicKey: {
      ...publicKey,
      challenge: fromBase64Url(publicKey.challenge),
      user: { ...publicKey.user, id: fromBase64Url(publicKey.user.id) },
      excludeCredentials: descriptors(publicKey.excludeCredentials),
    },
  })) as PublicKeyCredential | null;
  if (!credential) throw new DOMException('cancelled', 'NotAllowedError');
  const response = credential.response as AuthenticatorAttestationResponse;
  return {
    id: credential.id,
    rawId: toBase64Url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: toBase64Url(response.clientDataJSON),
      attestationObject: toBase64Url(response.attestationObject),
      transports: response.getTransports?.() ?? [],
    },
    clientExtensionResults: credential.getClientExtensionResults(),
  };
}

/** Ký challenge bằng passkey đã lưu cho tên miền này (trình duyệt cho chọn passkey) */
export async function getPasskey(publicKey: any): Promise<object> {
  const credential = (await navigator.credentials.get({
    publicKey: {
      ...publicKey,
      challenge: fromBase64Url(publicKey.challenge),
      allowCredentials: descriptors(publicKey.allowCredentials),
    },
  })) as PublicKeyCredential | null;
  if (!credential) throw new DOMException('cancelled', 'NotAllowedError');
  const response = credential.response as AuthenticatorAssertionResponse;
  return {
    id: credential.id,
    rawId: toBase64Url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: toBase64Url(response.clientDataJSON),
      authenticatorData: toBase64Url(response.authenticatorData),
      signature: toBase64Url(response.signature),
      userHandle: response.userHandle ? toBase64Url(response.userHandle) : null,
    },
    clientExtensionResults: credential.getClientExtensionResults(),
  };
}

/** Lỗi từ trình duyệt -> câu tiếng Việt; null nếu không phải lỗi WebAuthn */
export function passkeyErrorMessage(error: unknown): string | null {
  if (!(error instanceof DOMException)) return null;
  switch (error.name) {
    case 'NotAllowedError':
      return 'Đã huỷ hoặc hết thời gian xác thực passkey.';
    case 'InvalidStateError':
      return 'Thiết bị này đã có passkey cho tài khoản của bạn.';
    case 'SecurityError':
      return 'Passkey không dùng được trên địa chỉ này (cần HTTPS và đúng tên miền đã cấu hình).';
    case 'NotSupportedError':
      return 'Thiết bị hoặc trình duyệt này không hỗ trợ passkey.';
    default:
      return 'Không dùng được passkey, vui lòng thử lại.';
  }
}
