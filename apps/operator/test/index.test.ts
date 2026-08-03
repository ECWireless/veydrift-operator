import { describe, expect, test } from "bun:test";

import { createStartupMessage, OPERATOR_NAME } from "../src/index.ts";

describe("operator workspace", () => {
  test("exposes a stable startup message", () => {
    expect(createStartupMessage()).toBe(`${OPERATOR_NAME} workspace is ready`);
  });
});
