const crypto = require("crypto");
const QRCode = require("qrcode");

// Standard Base32 Alphabet (RFC 4648)
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

const base32Decode = (base32Str = "") => {
  const cleanedStr = base32Str.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = "";
  for (let i = 0; i < cleanedStr.length; i++) {
    const val = BASE32_ALPHABET.indexOf(cleanedStr.charAt(i));
    bits += val.toString(2).padStart(5, "0");
  }

  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }
  return Buffer.from(bytes);
};

const generateSecret = (length = 16) => {
  let secret = "";
  const randomBytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    secret += BASE32_ALPHABET[randomBytes[i] % 32];
  }
  return secret;
};

const generateTotpCode = (secretStr, timeStepOffset = 0) => {
  if (!secretStr) return null;
  const key = base32Decode(secretStr);
  const epoch = Math.floor(Date.now() / 1000);
  const timeStep = Math.floor(epoch / 30) + timeStepOffset;

  const timeBuffer = Buffer.alloc(8);
  timeBuffer.writeUInt32BE(0, 0);
  timeBuffer.writeUInt32BE(timeStep, 4);

  const hmac = crypto.createHmac("sha1", key);
  hmac.update(timeBuffer);
  const hmacResult = hmac.digest();

  const offset = hmacResult[hmacResult.length - 1] & 0x0f;
  const codeInt =
    ((hmacResult[offset] & 0x7f) << 24) |
    ((hmacResult[offset + 1] & 0xff) << 16) |
    ((hmacResult[offset + 2] & 0xff) << 8) |
    (hmacResult[offset + 3] & 0xff);

  const otp = codeInt % 1000000;
  return otp.toString().padStart(6, "0");
};

const verifyTotpCode = (secretStr, userCode, window = 1) => {
  if (!secretStr || !userCode) return false;
  const cleanCode = String(userCode).trim();
  if (cleanCode.length !== 6 || !/^\d{6}$/.test(cleanCode)) return false;

  for (let errorWindow = -window; errorWindow <= window; errorWindow++) {
    const validCode = generateTotpCode(secretStr, errorWindow);
    if (validCode === cleanCode) {
      return true;
    }
  }
  return false;
};

const generateQrCodeDataUrl = async (otpauthUrl) => {
  try {
    return await QRCode.toDataURL(otpauthUrl);
  } catch (err) {
    return null;
  }
};

const getOtpAuthUrl = (email, secret) => {
  const account = encodeURIComponent(email || "user@arogyaplus.com");
  const issuer = encodeURIComponent("ArogyaPlus");
  return `otpauth://totp/${issuer}:${account}?secret=${secret}&issuer=${issuer}&period=30&digits=6`;
};

module.exports = {
  generateSecret,
  generateTotpCode,
  verifyTotpCode,
  generateQrCodeDataUrl,
  getOtpAuthUrl
};
