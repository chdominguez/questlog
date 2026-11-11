import { describe, expect, it } from "vitest";
import { permutation, shuffled } from "./shuffle";

const seeded = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

describe("permutation", () => {
  it("returns every index once", () => {
    for (let n = 0; n < 8; n++) expect([...permutation(n)].sort()).toEqual(Array.from({ length: n }, (_, i) => i));
  });

  it("maps a displayed position back to the authored answer", () => {
    const options = ["right", "w1", "w2", "w3"];
    const answer = 0;
    const order = permutation(options.length, seeded(7));
    const pos = order.indexOf(answer);
    expect(options[order[pos]]).toBe("right");
    expect(order.map((oi) => oi === answer).filter(Boolean)).toHaveLength(1);
  });

  it("moves an authored answer 0 to every position over many attempts", () => {
    const rand = seeded(42);
    const seen = new Set<number>();
    for (let k = 0; k < 200; k++) seen.add(permutation(4, rand).indexOf(0));
    expect([...seen].sort()).toEqual([0, 1, 2, 3]);
  });

  it("2 options can stay in place (answer not always B)", () => {
    const rand = seeded(3);
    const firsts = new Set(Array.from({ length: 50 }, () => permutation(2, rand)[0]));
    expect(firsts.size).toBe(2);
  });
});

describe("shuffled", () => {
  it("never returns the identity", () => {
    const rand = seeded(1);
    for (let k = 0; k < 200; k++) expect(shuffled(3, rand)).not.toEqual([0, 1, 2]);
  });
});
