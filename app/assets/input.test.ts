import * as assert from "remix/assert";
import { describe, it } from "remix/test";

import { InputController } from "./input.ts";

describe("input controller", () => {
  it("maps semantic touch helpers onto the same per-tick actions as keyboard play", () => {
    let input = new InputController();

    input.pressLeft();
    assert.deepEqual(input.collect(), ["left"]);
    for (let i = 0; i < 8; i++) assert.deepEqual(input.collect(), []);
    assert.deepEqual(input.collect(), ["left"]);

    input.releaseLeft();
    assert.deepEqual(input.collect(), []);

    input.pressSoftDrop();
    assert.deepEqual(input.collect(), ["softDrop"]);
    assert.deepEqual(input.collect(), []);
    assert.deepEqual(input.collect(), ["softDrop"]);

    input.releaseSoftDrop();
    assert.deepEqual(input.collect(), []);
  });

  it("queues one-shot actions exactly once per tap", () => {
    let input = new InputController();

    input.tapRotateCCW();
    input.tapRotateCW();
    input.tapHold();
    input.tapHardDrop();

    assert.deepEqual(input.collect(), ["rotateCCW", "rotateCW", "hold", "hardDrop"]);
    assert.deepEqual(input.collect(), []);
  });
});
