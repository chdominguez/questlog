import { expect, test } from "vitest";
import { MIN_READABLE, minWidth, svgWidth } from "./svg";

test("svgWidth reads the viewBox width", () => {
  expect(svgWidth('<svg id="a" viewBox="-8 -8 978.5 420" style="max-width: 978px">')).toBe(978.5);
  expect(svgWidth('<svg viewBox="0,0,300,100">')).toBe(300);
  expect(svgWidth("<svg>")).toBe(0);
});

test("minWidth keeps wide diagrams near natural size", () => {
  expect(minWidth(400)).toBe(400);
  expect(minWidth(900)).toBe(MIN_READABLE);
  expect(minWidth(2000)).toBe(1400);
  expect(minWidth(0)).toBe(0);
});
