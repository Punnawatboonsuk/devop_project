import crypto from "crypto";

export function gensalt(length = 16) {
  return crypto.randomBytes(length).toString("base64");
}

export function hashpw(password, salt, iterations = 200_000, dklen = 32) {
  if (typeof password === "string") {
    password = Buffer.from(password, "utf-8");
  }

  const saltBytes = Buffer.from(salt, "base64");
  const dk = crypto.pbkdf2Sync(password, saltBytes, iterations, dklen, "sha256");

  return `pbkdf2_sha256$${iterations}$${salt}$${dk.toString("base64")}`;
}

export function checkpw(password, stored) {
  try {
    const [algo, iterStr, salt, hashB64] = stored.split("$");
    if (algo !== "pbkdf2_sha256") return false;

    const iterations = parseInt(iterStr, 10);
    const expected = Buffer.from(hashB64, "base64");

    if (typeof password === "string") {
      password = Buffer.from(password, "utf-8");
    }

    const saltBytes = Buffer.from(salt, "base64");
    const candidate = crypto.pbkdf2Sync(
      password,
      saltBytes,
      iterations,
      expected.length,
      "sha256"
    );

    return crypto.timingSafeEqual(candidate, expected);
  } catch {
    return false;
  }
}
