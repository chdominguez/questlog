import { describe, expect, it } from "vitest";
import { summaryLine, wrapTables } from "./markdown";

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
