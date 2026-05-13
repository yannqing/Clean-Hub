const ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const ULID_LENGTH = 26;
const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

let lastTimestamp = -1;
let lastRandom: number[] = [];

function encodeTime(timestamp: number): string {
  if (!Number.isSafeInteger(timestamp) || timestamp < 0) {
    throw new Error("ULID timestamp must be a positive safe integer.");
  }

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
    if (next[index] < 31) {
      next[index] += 1;
      return next;
    }

    next[index] = 0;
  }

  throw new Error("ULID random part overflow.");
}

function encodeRandomPart(randomPart: number[]): string {
  return randomPart.map((value) => ENCODING[value] ?? "0").join("");
}

export type Ulid = string;

export function createId(timestamp = Date.now()): Ulid {
  const randomPart =
    timestamp === lastTimestamp && lastRandom.length > 0
      ? incrementRandomPart(lastRandom)
      : createRandomPart();

  lastTimestamp = timestamp;
  lastRandom = randomPart;

  return `${encodeTime(timestamp)}${encodeRandomPart(randomPart)}`;
}

export function isUlid(value: string): value is Ulid {
  return ULID_PATTERN.test(value);
}

export function assertUlid(value: string): asserts value is Ulid {
  if (!isUlid(value)) {
    throw new Error(`Invalid ULID: ${value}`);
  }
}

export { ULID_LENGTH };
