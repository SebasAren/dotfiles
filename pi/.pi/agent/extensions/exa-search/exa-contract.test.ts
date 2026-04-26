import { describe, it, expect } from "bun:test";
import Exa from "exa-js";

describe("exa-js API contract", () => {
  it("constructs without errors", () => {
    const exa = new Exa("test-api-key");
    expect(exa).toBeDefined();
  });

  it("has searchAndContents method", () => {
    const exa = new Exa("test-api-key");
    expect(typeof exa.searchAndContents).toBe("function");
  });

  it("has getContents method", () => {
    const exa = new Exa("test-api-key");
    expect(typeof exa.getContents).toBe("function");
  });

  it("has search method", () => {
    const exa = new Exa("test-api-key");
    expect(typeof exa.search).toBe("function");
  });
});
