import * as assert from "remix/assert";
import { describe, it } from "remix/test";

import {
  createInitialState,
  DEFAULT_MAX_TICKS,
  levelFor,
  levelForLines,
  maxTicksForMode,
  simulate,
  step,
  SURVIVAL_MAX_TICKS,
} from "../app/game/engine.ts";
import { generateGameoverReplay } from "./gameover-replay.ts";

// gravityTicksFor is not exported - test via levelFor and step behavior instead.

describe("classic engine", () => {
  it("level rises every 10 lines cleared", () => {
    let state = createInitialState(1, "classic");
    assert.equal(levelFor(state), 1);

    state.linesCleared = 10;
    assert.equal(levelFor(state), 2);

    state.linesCleared = 25;
    assert.equal(levelFor(state), 3);
  });

  it("levelForLines matches levelFor", () => {
    let state = createInitialState(5, "classic");
    state.linesCleared = 35;
    assert.equal(levelFor(state), levelForLines(state.mode, state.linesCleared));
  });

  it("simulate returns gameover with level for classic mode", () => {
    let replay = generateGameoverReplay(42);
    let result = simulate(replay.seed, replay.mode, replay.actions);
    assert.equal(result.status, "gameover");
    assert.equal(result.won, false);
    assert.equal(result.level, replay.level);
    assert.equal(result.durationMs, replay.duration_ms);
  });

  it("allocates a higher simulate cap for classic than sprint", () => {
    let longRecorded = [{ tick: DEFAULT_MAX_TICKS + 1000, action: "hardDrop" as const }];
    assert.ok(maxTicksForMode("classic", longRecorded) > DEFAULT_MAX_TICKS);
    assert.equal(maxTicksForMode("sprint40", longRecorded), DEFAULT_MAX_TICKS);
  });

  it("caps classic simulate time at two hours of game time", () => {
    let huge = [{ tick: SURVIVAL_MAX_TICKS, action: "hardDrop" as const }];
    assert.equal(maxTicksForMode("classic", huge), SURVIVAL_MAX_TICKS);
  });

  it("gravity accelerates as level increases", () => {
    let early = createInitialState(99, "classic");

    // Compare drop counts over a fixed number of ticks with no input.
    function dropsAfterTicks(state: typeof early, ticks: number): number {
      let startY = state.active!.y;
      for (let i = 0; i < ticks; i++) step(state, []);
      return state.active!.y - startY;
    }

    let earlyDrops = dropsAfterTicks(early, 200);
    let lateState = createInitialState(99, "classic");
    lateState.linesCleared = 50;
    let lateDrops = dropsAfterTicks(lateState, 200);
    assert.ok(
      lateDrops > earlyDrops,
      `expected more drops at high level: ${lateDrops} vs ${earlyDrops}`,
    );
  });
});

describe("format helpers", () => {
  it("formats classic durations", async () => {
    let { formatClassicScore, formatDurationLong } = await import("../app/utils/format.ts");
    assert.equal(formatDurationLong(50_000), "50s");
    assert.equal(formatDurationLong(730_000), "12m 10s");
    assert.equal(formatClassicScore(5, 730_000), "5 / 12m 10s");
  });
});

describe("classic score comparison", () => {
  it("ranks higher level first, then longer time", async () => {
    let { beatsClassicScore } = await import("../app/data/games.ts");
    assert.ok(
      beatsClassicScore({ level: 12, duration_ms: 1000 }, { level: 10, duration_ms: 999_999 }),
    );
    assert.ok(
      beatsClassicScore({ level: 10, duration_ms: 2000 }, { level: 10, duration_ms: 1000 }),
    );
    assert.ok(!beatsClassicScore({ level: 5, duration_ms: 1000 }, { level: 10, duration_ms: 100 }));
  });
});
