const ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

let lastTimestamp = -1;
let lastRandom: number[] = [];

function encodeTime(timestamp: number): string {
  let value = timestamp;
  const chars = new Array<string>(10);

  for (let index = 9; index >= 0; index -= 1) {
    chars[index] = ENCODING[value % 32] ?? "0";
    value = Math.floor(value / 32);
  }

  return chars.join("");
}

function getRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);

  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
    return bytes;
  }

  for (let index = 0; index < length; index += 1) {
    bytes[index] = Math.floor(Math.random() * 256);
  }

  return bytes;
}

function createRandomPart(): number[] {
  return [...getRandomBytes(16)].map((byte) => byte & 31);
}

function incrementRandomPart(randomPart: number[]): number[] {
  const next = [...randomPart];

  for (let index = next.length - 1; index >= 0; index -= 1) {
    const value = next[index] ?? 0;

    if (value < 31) {
      next[index] = value + 1;
      return next;
    }

    next[index] = 0;
  }

  return createRandomPart();
}

function encodeRandomPart(randomPart: number[]): string {
  return randomPart.map((value) => ENCODING[value] ?? "0").join("");
}

export function createCustomerLocalId(timestamp = Date.now()): string {
  const randomPart =
    timestamp === lastTimestamp && lastRandom.length > 0
      ? incrementRandomPart(lastRandom)
      : createRandomPart();

  lastTimestamp = timestamp;
  lastRandom = randomPart;

  return `${encodeTime(timestamp)}${encodeRandomPart(randomPart)}`;
}
