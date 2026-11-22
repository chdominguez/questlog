import { describe, expect, it } from "vitest";
import { localImage, summaryLine, wrapTables } from "./markdown";

describe("markdown helpers", () => {
  it("wraps every table in a scroll box", () => {
    expect(wrapTables("<p>a</p><table><tr><td>1</td></tr></table><table></table>"))
      .toBe('<p>a</p><div class="tbl"><table><tr><td>1</td></tr></table></div><div class="tbl"><table></table></div>');
  });
  it("summarizes with the first non-table line, markers dropped", () => {
    expect(summaryLine("| a | b |\n|---|---|\n- **Pick** one")).toBe("**Pick** one");
    expect(summaryLine("## Title\nmore")).toBe("Title");
    expect(summaryLine("plain")).toBe("plain");
  });
});

it("localImage: this app, its API and data: only", () => {
  const here = "https://app.test/#/c/x";
  expect(localImage("/media/c/a.png", here, "")).toBe(true);
  expect(localImage("https://app.test/a.png", here, "")).toBe(true);
  expect(localImage("data:image/png;base64,AA", here, "")).toBe(true);
  expect(localImage("https://api.test/media/c/a.png", here, "https://api.test")).toBe(true);
  expect(localImage("https://tracker.test/p.gif", here, "https://api.test")).toBe(false);
  expect(localImage("//tracker.test/p.gif", here, "")).toBe(false);
});
