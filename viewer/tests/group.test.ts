import { describe, expect, it } from "vitest";

import { groupEndpoints } from "../src/lib/group.js";
import { getEndpoint, makeSpec, postEndpoint } from "./fixtures.js";

describe("groupEndpoints", () => {
  it("groups by path in first-appearance order", () => {
    const spec = makeSpec();
    const groups = groupEndpoints(spec.endpoints);
    expect(groups.map((g) => g.path)).toEqual(["/trials"]);
    expect(groups[0]?.endpoints.map((e) => e.method)).toEqual(["GET", "POST"]);
    expect(groups[0]?.resourceDescription).toBe("Trials resource");
  });

  it("keeps distinct resources separate and in order", () => {
    const other = {
      ...getEndpoint,
      path: "/other",
      method: "PUT",
      resourceDescription: undefined,
    };
    const groups = groupEndpoints([other, postEndpoint, getEndpoint]);
    expect(groups.map((g) => g.path)).toEqual(["/other", "/trials"]);
    expect(groups[1]?.endpoints.map((e) => e.method)).toEqual(["POST", "GET"]);
    expect(groups[1]?.resourceDescription).toBe("Trials resource");
    expect(groups[0]?.resourceDescription).toBeUndefined();
  });
});
