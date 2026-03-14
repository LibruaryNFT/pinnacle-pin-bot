import { describe, it, expect } from "vitest";
import {
  extract,
  decodeEventPayloadBase64,
  unwrapAddressField,
  formatPrice,
  composeTweet,
} from "../lib/helpers.js";

describe("extract", () => {
  it("returns primitives as-is", () => {
    expect(extract("hello")).toBe("hello");
    expect(extract(42)).toBe(42);
    expect(extract(null)).toBe(null);
    expect(extract(undefined)).toBe(undefined);
  });

  it("unwraps a simple {value} object", () => {
    expect(extract({ value: "abc" })).toBe("abc");
  });

  it("recursively unwraps nested {value} objects", () => {
    expect(extract({ value: { value: "deep" } })).toBe("deep");
  });

  it("extracts typeID from a Type object", () => {
    const typeObj = {
      type: "Type",
      value: { staticType: { typeID: "A.edf9df96c92f4595.Pinnacle.NFT" } },
    };
    expect(extract(typeObj)).toBe("A.edf9df96c92f4595.Pinnacle.NFT");
  });

  it("returns plain objects without 'value' key unchanged", () => {
    const obj = { name: "test", id: 1 };
    expect(extract(obj)).toEqual(obj);
  });
});

describe("decodeEventPayloadBase64", () => {
  it("decodes a valid base64 JSON payload", () => {
    const payload = { value: { fields: [{ name: "id", value: "123" }] } };
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64");
    expect(decodeEventPayloadBase64(encoded)).toEqual(payload);
  });

  it("returns null for invalid base64", () => {
    expect(decodeEventPayloadBase64("not-valid-base64!!!")).toBe(null);
  });

  it("returns null for valid base64 that is not JSON", () => {
    const encoded = Buffer.from("this is not json").toString("base64");
    expect(decodeEventPayloadBase64(encoded)).toBe(null);
  });
});

describe("unwrapAddressField", () => {
  it("returns a plain string address", () => {
    expect(unwrapAddressField("0xabcdef1234567890")).toBe("0xabcdef1234567890");
  });

  it("unwraps {value, type} format", () => {
    expect(unwrapAddressField({ value: "0xabc123", type: "Address" })).toBe("0xabc123");
  });

  it("unwraps Optional wrapper", () => {
    const field = {
      type: "Optional",
      value: { value: "0x1234567890abcdef", type: "Address" },
    };
    expect(unwrapAddressField(field)).toBe("0x1234567890abcdef");
  });

  it("extracts from .address property", () => {
    expect(unwrapAddressField({ address: "0xdeadbeef12345678" })).toBe("0xdeadbeef12345678");
  });

  it("finds address in deeply nested object", () => {
    const nested = {
      outer: {
        inner: { addr: "0x1234567890abcdef" },
      },
    };
    expect(unwrapAddressField(nested)).toBe("0x1234567890abcdef");
  });

  it("returns null for null/undefined", () => {
    expect(unwrapAddressField(null)).toBe(null);
    expect(unwrapAddressField(undefined)).toBe(null);
  });

  it("returns null for objects with no recognizable address", () => {
    expect(unwrapAddressField({ foo: 42, bar: "short" })).toBe(null);
  });
});

describe("formatPrice", () => {
  it("rounds and formats whole numbers", () => {
    expect(formatPrice(1000)).toBe("1,000");
  });

  it("rounds decimal prices", () => {
    expect(formatPrice(249.99)).toBe("250");
  });

  it("handles small prices", () => {
    expect(formatPrice(5)).toBe("5");
  });
});

describe("composeTweet", () => {
  it("composes a one-liner with price and character", () => {
    const tweet = composeTweet({
      usd: 500,
      ed: { id: 42 },
      chars: "Mickey Mouse, Donald Duck",
    });

    expect(tweet).toContain("$500");
    expect(tweet).toContain("Mickey Mouse, Donald Duck");
    expect(tweet).toContain("@DisneyPinnacle");
    expect(tweet).toContain("https://disneypinnacle.com/pin/42");
  });
});
