import { describe, expect, it } from "bun:test";
import { planQuery } from "./query-planner";

describe("planQuery intent classification", () => {
  it("classifies 'define' queries", () => {
    expect(planQuery("where is parseQuestions defined").intent).toBe("define");
    expect(planQuery("what is the meaning of life").intent).toBe("define");
  });

  it("classifies 'use' queries", () => {
    expect(planQuery("how to use runQuestionnaire").intent).toBe("use");
    expect(planQuery("how does FileIndex work").intent).toBe("use");
    expect(planQuery("show me an example of buildExtractPrompt").intent).toBe("use");
  });

  it("classifies 'arch' queries", () => {
    expect(planQuery("architecture of the plugin system").intent).toBe("arch");
    expect(planQuery("overview of the codebase").intent).toBe("arch");
    expect(planQuery("what is the system design").intent).toBe("arch");
  });

  it("classifies 'change' queries", () => {
    expect(planQuery("change the docker compose file").intent).toBe("change");
    expect(planQuery("refactor the login function").intent).toBe("change");
    expect(planQuery("fix the broken test").intent).toBe("change");
  });
});

describe("planQuery entity extraction", () => {
  it("extracts camelCase identifiers", () => {
    const plan = planQuery("how does runQuestionnaire work");
    expect(plan.entities).toContain("runQuestionnaire");
  });

  it("extracts snake_case identifiers", () => {
    const plan = planQuery("parse_questions should be faster");
    expect(plan.entities).toContain("parse_questions");
  });

  it("extracts PascalCase identifiers", () => {
    const plan = planQuery("What is QuestionnaireResult used for");
    expect(plan.entities).toContain("QuestionnaireResult");
  });

  it("extracts kebab-case identifiers", () => {
    const plan = planQuery("update file-index parser");
    expect(plan.entities).toContain("file-index");
    expect(plan.entities).toContain("parser");
  });

  it("extracts quoted strings", () => {
    const plan = planQuery('look for "query planner" logic');
    expect(plan.entities).toContain("query planner");
  });

  it("filters out stop words", () => {
    const plan = planQuery("the and for with from that this");
    expect(plan.entities).not.toContain("the");
    expect(plan.entities).not.toContain("and");
    expect(plan.entities).toHaveLength(0);
  });
});

describe("planQuery grepTerms and avoidTerms", () => {
  it("puts compound identifiers into grepTerms", () => {
    const plan = planQuery("pre_search query planner");
    expect(plan.grepTerms).toContain("pre_search");
    expect(plan.grepTerms).toContain("query");
    expect(plan.grepTerms).toContain("planner");
  });

  it("flags short components ≤2 chars as avoidTerms", () => {
    const plan = planQuery("pi-config and wt-common");
    expect(plan.avoidTerms).toContain("pi");
    expect(plan.avoidTerms).toContain("wt");
  });

  it("keeps 3-char parts as grepTerms when present as standalone words", () => {
    const plan = planQuery("api client library");
    expect(plan.avoidTerms).not.toContain("api");
    expect(plan.grepTerms).toContain("api");
  });

  it("limits grepTerms to 8", () => {
    const plan = planQuery("a b c d e f g h i j k l m n o p q r s t");
    expect(plan.grepTerms.length).toBeLessThanOrEqual(8);
  });

  it("limits avoidTerms to 5", () => {
    const plan = planQuery("a-b c-d e-f g-h i-j k-l");
    expect(plan.avoidTerms.length).toBeLessThanOrEqual(5);
  });
});

describe("planQuery scope hints and file patterns", () => {
  it("extracts directory paths as scope hints", () => {
    const plan = planQuery("find in src/components");
    expect(plan.scopeHints).toContain("src/components");
  });

  it("infers yaml patterns for docker-related queries", () => {
    const plan = planQuery("change the docker compose file");
    expect(plan.filePatterns).toContain("*.yaml");
    expect(plan.filePatterns).toContain("*.yml");
    expect(plan.filePatterns).toContain("docker-compose.*");
  });

  it("falls back to default patterns when no keyword matches", () => {
    const plan = planQuery("what is the meaning of life");
    expect(plan.filePatterns).toContain("*.ts");
    expect(plan.filePatterns).toContain("*.js");
    expect(plan.filePatterns).toContain("*.py");
  });
});
