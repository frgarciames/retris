import * as assert from "remix/assert";
import { describe, it } from "remix/test";

import {
  applyGarbageNow,
  createInitialState,
  step,
  type Action,
  type RecordedAction,
} from "./engine.ts";
import { buildTimeline, reconstructVersus, type RecordedGarbage } from "./versus-replay.ts";

// The reconnect-resume path rebuilds a live board from its recorded inputs and
// received garbage. This guards that the rebuild is bit-identical to the
// original play-through (same ordering: garbage lands, then inputs, each tick).
describe("versus replay reconstruction", () => {
  it("rebuilds the exact board from recorded inputs and garbage", () => {
    let seed = 4242;
    let scriptedActions = new Map<number, Action[]>([
      [3, ["left"]],
      [4, ["rotateCW"]],
      [6, ["hardDrop"]],
      [20, ["right", "hardDrop"]],
      [45, ["hardDrop"]],
      [70, ["left", "left", "hardDrop"]],
    ]);
    let scriptedGarbage = new Map<number, number[]>([
      [12, [2, 5]],
      [55, [8]],
    ]);

    // Play it live, recording exactly what a real client would.
    let live = createInitialState(seed, "versus");
    let actions: RecordedAction[] = [];
    let garbage: RecordedGarbage[] = [];
    for (let t = 0; t < 120 && live.status === "playing"; t++) {
      let holes = scriptedGarbage.get(live.tick);
      if (holes) {
        garbage.push({ tick: live.tick, holes });
        applyGarbageNow(live, holes);
        if (live.status !== "playing") break;
      }
      let acts = scriptedActions.get(live.tick) ?? [];
      for (let action of acts) actions.push({ tick: live.tick, action });
      step(live, acts);
    }

    // Rebuild from the recording and compare.
    let timeline = buildTimeline({ seed, mode: "versus", actions, garbage });
    let rebuilt = reconstructVersus(timeline, live.tick);

    assert.equal(rebuilt.tick, live.tick);
    assert.equal(rebuilt.linesCleared, live.linesCleared);
    assert.equal(rebuilt.status, live.status);
    assert.deepEqual(Array.from(rebuilt.board), Array.from(live.board));
    assert.deepEqual(rebuilt.active, live.active);
  });
});
