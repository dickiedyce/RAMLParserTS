/**
 * Groups endpoints by resource path, preserving declaration order
 * (PARITY.md #3) for the endpoints view and markdown export.
 */
import type { Endpoint } from "../../../src/index.js";

export interface ResourceGroup {
  path: string;
  resourceDescription: string | undefined;
  endpoints: Endpoint[];
}

export function groupEndpoints(endpoints: Endpoint[]): ResourceGroup[] {
  const groups: ResourceGroup[] = [];
  const byPath = new Map<string, ResourceGroup>();
  for (const endpoint of endpoints) {
    let group = byPath.get(endpoint.path);
    if (group === undefined) {
      group = {
        path: endpoint.path,
        resourceDescription: endpoint.resourceDescription,
        endpoints: [],
      };
      byPath.set(endpoint.path, group);
      groups.push(group);
    }
    group.endpoints.push(endpoint);
  }
  return groups;
}
