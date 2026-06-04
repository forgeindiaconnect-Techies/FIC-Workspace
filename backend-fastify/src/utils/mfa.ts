import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

export interface IMfaSecretResponse {
  secret: string;
  otpauthUrl: string;
  qrCodeBase64: string;
}

/**
 * Generates a new secure TOTP MFA secret and converts it to a scannable QR code
 */
export async function generateMfaSecret(email: string): Promise<IMfaSecretResponse> {
  const secret = speakeasy.generateSecret({
    name: `ForgeIndiaConnect:${email}`,
    length: 20
  });

  const otpauthUrl = secret.otpauth_url || '';
  
  // Convert QR Code URL to a Base64 PNG image stream for clients to display
  const qrCodeBase64 = await QRCode.toDataURL(otpauthUrl);

  return {
    secret: secret.base32,
    otpauthUrl,
    qrCodeBase64
  };
}

/**
 * Verifies a user-provided 6-digit TOTP token against their registered secret
 */
export function verifyMfaToken(secret: string, token: string): boolean {
  return speakeasy.totp.verify({
    secret: secret,
    encoding: 'base32',
    token: token,
    window: 2 // Allow 1 step grace before/after to accommodate slight system clock drifts
  });
}
