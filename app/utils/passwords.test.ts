import * as assert from "remix/assert";
import { describe, it } from "remix/test";

import { hashPassword, verifyPassword } from "./passwords.ts";

describe("passwords", () => {
  it("verifies a correct password", async () => {
    let hash = await hashPassword("correct horse battery staple");
    assert.equal(await verifyPassword("correct horse battery staple", hash), true);
  });

  it("rejects an incorrect password", async () => {
    let hash = await hashPassword("correct horse battery staple");
    assert.equal(await verifyPassword("Tr0ub4dour", hash), false);
  });

  it("produces a different hash each time (random salt)", async () => {
    let a = await hashPassword("same");
    let b = await hashPassword("same");
    assert.notEqual(a, b);
    assert.equal(await verifyPassword("same", a), true);
    assert.equal(await verifyPassword("same", b), true);
  });

  it("rejects malformed stored values", async () => {
    assert.equal(await verifyPassword("x", "not-a-valid-hash"), false);
  });
});
