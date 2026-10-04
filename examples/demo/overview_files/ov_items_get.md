Manage the demo inventory.

### Functional Requirements:

| #       | Use Case | Detailed Description                                                 | Acceptance Criteria Description               |
| ------- | -------- | -------------------------------------------------------------------- | --------------------------------------------- |
| FR-D-01 | UC-01    | As a consumer, I want to list items, optionally filtered by barcode. | A filtered list is returned within 2 seconds. |

### Non-Functional Requirements:

| #        | Use Case | Detailed Description                  | Acceptance Criteria Description |
| -------- | -------- | ------------------------------------- | ------------------------------- |
| NFR-D-01 | UC-02    | Item reads are cached for 60 seconds. | Cache hit rate above 80%.       |
