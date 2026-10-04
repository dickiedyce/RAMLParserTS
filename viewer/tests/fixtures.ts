/**
 * Shared fixture: a synthetic C-hybrid ParsedSpec for viewer tests
 * (structure mirrors the LEAP-style sample exports; invented content).
 */
import type { Endpoint, ParsedSpec, Requirement } from "../../src/index.js";

export const resourceRequirement: Requirement = {
  reqId: "FR-S-G-01",
  reqType: "FR",
  useCase: "UC-01",
  description: "Get firewall flag",
  acceptanceCriteria: "Returns the flag",
  scope: "resource",
  source: { file: "overview_files/ov.md", line: 5 },
};

export const methodRequirement: Requirement = {
  reqId: "NFR-M-01",
  reqType: "NFR",
  useCase: "UC-02",
  description: "Respond within 2s",
  acceptanceCriteria: "Measured at p95",
  scope: "method",
  source: { file: "overview_files/ovm.md", line: 6 },
};

export const getEndpoint: Endpoint = {
  path: "/trials",
  method: "GET",
  summary: "Get trials",
  description: "Returns trials",
  resourceDescription: "Trials resource",
  parameters: [
    {
      name: "id",
      location: "path",
      required: true,
      type: "string",
      description: "Trial id",
      example: "T-1",
    },
    {
      name: "verbose",
      location: "query",
      required: false,
      type: "boolean",
      description: "Verbose",
      example: true,
    },
    {
      name: "limit",
      location: "query",
      required: false,
      type: "integer",
      description: "Limit | capped",
      minimum: 1,
      maximum: 10,
    },
  ],
  responses: [
    {
      statusCode: "200",
      description: "OK",
      body: {
        contentType: "application/json",
        type: "TrialList",
        examples: { example: { items: ["T-1"] } },
      },
    },
    { statusCode: "204", description: "No content" },
  ],
  requirements: [resourceRequirement, methodRequirement],
  securitySchemeIds: ["clientIdEnforcement"],
};

export const postEndpoint: Endpoint = {
  path: "/trials",
  method: "POST",
  summary: "Create trial",
  description: "Creates a trial",
  resourceDescription: "Trials resource",
  parameters: [],
  requestBody: {
    contentType: "application/json",
    type: "Trial",
    examples: { Sample: { id: "T-2" } },
  },
  responses: [{ statusCode: "201", description: "Created" }],
  requirements: [resourceRequirement],
  securitySchemeIds: ["anonymous"],
};

export function makeSpec(): ParsedSpec {
  return {
    apiInfo: {
      title: "Trials API",
      version: "v1",
      description: "A trials API",
      baseUri: "https://api.example.com",
      protocols: ["HTTPS"],
      mediaType: "application/json",
      documentation: [{ title: "Guide", content: "Welcome" }],
      securitySchemes: {
        clientIdEnforcement: {
          type: "Client ID Enforcement",
          description: "Needs a client id",
        },
        anonymous: {
          type: "anonymous",
          description: "No authentication required (public)",
        },
      },
    },
    endpoints: [getEndpoint, postEndpoint],
    requirements: [resourceRequirement, methodRequirement],
    diagnostics: [
      {
        code: "include-fallback",
        severity: "warning",
        message: "Include resolved from spec root",
        path: "api.raml",
        line: 12,
      },
    ],
  };
}
