import crypto from "crypto";

export async function generateQrCode(orderId: string): Promise<string> {
  // Générer un token unique et sécurisé pour le QR code
  const token = crypto
    .createHash("sha256")
    .update(`${orderId}-${Date.now()}-${Math.random()}`)
    .digest("hex")
    .slice(0, 32);

  return token;
}
