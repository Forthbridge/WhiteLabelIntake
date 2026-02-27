import { describe, it, expect } from "vitest";
import {
  resolveBundleRules,
  mergeLocationBundles,
  type BundleRuleWithTargets,
  type VisitItem,
} from "./bundle-resolution";

// ─── Helpers ──────────────────────────────────────────────────────────

function makeRule(overrides: Partial<BundleRuleWithTargets> & Pick<BundleRuleWithTargets, "name" | "targets">): BundleRuleWithTargets {
  return {
    ruleType: "flat_rate",
    price: 100,
    includesVisitFee: false,
    ...overrides,
  };
}

function makeItem(serviceType: string, subType?: string, unitPrice: number | null = 10): VisitItem {
  return { serviceType, subType, unitPrice };
}

// ─── resolveBundleRules ───────────────────────────────────────────────

describe("resolveBundleRules", () => {
  it("returns empty results when no rules provided", () => {
    const items = [makeItem("labs", "cbc")];
    const result = resolveBundleRules([], items);

    expect(result.appliedBundles).toHaveLength(0);
    expect(result.unbundledItems).toEqual(items);
    expect(result.visitFeeAbsorbed).toBe(false);
  });

  it("returns empty results when no items provided", () => {
    const rules = [makeRule({ name: "R1", targets: [{ serviceType: "labs", subType: null }] })];
    const result = resolveBundleRules(rules, []);

    expect(result.appliedBundles).toHaveLength(0);
    expect(result.unbundledItems).toHaveLength(0);
    expect(result.visitFeeAbsorbed).toBe(false);
  });

  it("matches a category-level target to all items of that serviceType", () => {
    const rules = [makeRule({
      name: "All Labs",
      price: 50,
      targets: [{ serviceType: "labs", subType: null }],
    })];
    const items = [
      makeItem("labs", "cbc"),
      makeItem("labs", "a1c"),
      makeItem("procedures", "laceration"),
    ];

    const result = resolveBundleRules(rules, items);

    expect(result.appliedBundles).toHaveLength(1);
    expect(result.appliedBundles[0].name).toBe("All Labs");
    expect(result.appliedBundles[0].coveredItems).toHaveLength(2);
    expect(result.unbundledItems).toHaveLength(1);
    expect(result.unbundledItems[0].subType).toBe("laceration");
  });

  it("matches a sub-service target to exact serviceType + subType", () => {
    const rules = [makeRule({
      name: "CBC Only",
      price: 20,
      targets: [{ serviceType: "labs", subType: "cbc" }],
    })];
    const items = [
      makeItem("labs", "cbc"),
      makeItem("labs", "a1c"),
    ];

    const result = resolveBundleRules(rules, items);

    expect(result.appliedBundles).toHaveLength(1);
    expect(result.appliedBundles[0].coveredItems).toHaveLength(1);
    expect(result.appliedBundles[0].coveredItems[0].subType).toBe("cbc");
    expect(result.unbundledItems).toHaveLength(1);
    expect(result.unbundledItems[0].subType).toBe("a1c");
  });

  it("skips rules with no matching items", () => {
    const rules = [makeRule({
      name: "DME Bundle",
      targets: [{ serviceType: "dme", subType: null }],
    })];
    const items = [makeItem("labs", "cbc")];

    const result = resolveBundleRules(rules, items);

    expect(result.appliedBundles).toHaveLength(0);
    expect(result.unbundledItems).toHaveLength(1);
  });

  it("more-specific rules claim items first (specificity wins)", () => {
    const specificRule = makeRule({
      name: "CBC Special",
      price: 15,
      targets: [{ serviceType: "labs", subType: "cbc" }], // specificity = 2
    });
    const broadRule = makeRule({
      name: "All Labs",
      price: 80,
      targets: [{ serviceType: "labs", subType: null }], // specificity = 1
    });

    const items = [
      makeItem("labs", "cbc"),
      makeItem("labs", "a1c"),
      makeItem("labs", "lipid"),
    ];

    const result = resolveBundleRules([broadRule, specificRule], items);

    // Specific rule should claim cbc
    const cbcBundle = result.appliedBundles.find((b) => b.name === "CBC Special");
    expect(cbcBundle).toBeDefined();
    expect(cbcBundle!.coveredItems).toHaveLength(1);
    expect(cbcBundle!.coveredItems[0].subType).toBe("cbc");

    // Broad rule should claim the remaining a1c + lipid
    const labsBundle = result.appliedBundles.find((b) => b.name === "All Labs");
    expect(labsBundle).toBeDefined();
    expect(labsBundle!.coveredItems).toHaveLength(2);

    expect(result.unbundledItems).toHaveLength(0);
  });

  it("does not double-claim items across rules", () => {
    const rule1 = makeRule({
      name: "Labs Bundle",
      targets: [{ serviceType: "labs", subType: null }],
    });
    const rule2 = makeRule({
      name: "Also Labs",
      targets: [{ serviceType: "labs", subType: null }],
    });

    const items = [makeItem("labs", "cbc"), makeItem("labs", "a1c")];
    const result = resolveBundleRules([rule1, rule2], items);

    // Both rules have same specificity — first one claims all items
    expect(result.appliedBundles).toHaveLength(1);
    expect(result.appliedBundles[0].coveredItems).toHaveLength(2);
  });

  it("sets visitFeeAbsorbed when a bundle includes visit fee", () => {
    const rules = [makeRule({
      name: "Visit + Labs",
      includesVisitFee: true,
      targets: [{ serviceType: "labs", subType: null }],
    })];
    const items = [makeItem("labs", "cbc")];

    const result = resolveBundleRules(rules, items);

    expect(result.visitFeeAbsorbed).toBe(true);
  });

  it("visitFeeAbsorbed is false when no bundle includes visit fee", () => {
    const rules = [makeRule({
      name: "Labs Only",
      includesVisitFee: false,
      targets: [{ serviceType: "labs", subType: null }],
    })];
    const items = [makeItem("labs", "cbc")];

    const result = resolveBundleRules(rules, items);

    expect(result.visitFeeAbsorbed).toBe(false);
  });

  it("handles multiple non-overlapping bundles", () => {
    const labsRule = makeRule({
      name: "Labs Bundle",
      price: 50,
      targets: [{ serviceType: "labs", subType: null }],
    });
    const procRule = makeRule({
      name: "Procedures Bundle",
      price: 150,
      targets: [{ serviceType: "procedures", subType: null }],
    });

    const items = [
      makeItem("labs", "cbc"),
      makeItem("labs", "a1c"),
      makeItem("procedures", "laceration"),
    ];

    const result = resolveBundleRules([labsRule, procRule], items);

    expect(result.appliedBundles).toHaveLength(2);
    expect(result.unbundledItems).toHaveLength(0);
  });

  it("all ruleType values are flat_rate", () => {
    const rules = [makeRule({
      name: "Test",
      targets: [{ serviceType: "labs", subType: null }],
    })];
    const items = [makeItem("labs", "cbc")];

    const result = resolveBundleRules(rules, items);

    expect(result.appliedBundles[0].ruleType).toBe("flat_rate");
  });

  it("handles items with no subType", () => {
    const rules = [makeRule({
      name: "Category",
      targets: [{ serviceType: "labs", subType: null }],
    })];
    const items = [makeItem("labs")]; // no subType

    const result = resolveBundleRules(rules, items);

    expect(result.appliedBundles).toHaveLength(1);
    expect(result.appliedBundles[0].coveredItems).toHaveLength(1);
  });

  it("multi-target rule matches across target list", () => {
    const rule = makeRule({
      name: "Labs + Procedures",
      price: 200,
      targets: [
        { serviceType: "labs", subType: null },
        { serviceType: "procedures", subType: "laceration" },
      ],
    });

    const items = [
      makeItem("labs", "cbc"),
      makeItem("procedures", "laceration"),
      makeItem("procedures", "suture"),
    ];

    const result = resolveBundleRules([rule], items);

    expect(result.appliedBundles).toHaveLength(1);
    // cbc + laceration matched, suture not matched (target is specific)
    expect(result.appliedBundles[0].coveredItems).toHaveLength(2);
    expect(result.unbundledItems).toHaveLength(1);
    expect(result.unbundledItems[0].subType).toBe("suture");
  });
});

// ─── mergeLocationBundles ─────────────────────────────────────────────

describe("mergeLocationBundles", () => {
  it("returns org bundles when no location bundles", () => {
    const orgBundles = [makeRule({ name: "Org", targets: [{ serviceType: "labs", subType: null }] })];
    const result = mergeLocationBundles(orgBundles, []);

    expect(result).toEqual(orgBundles);
  });

  it("location bundles replace overlapping org bundles", () => {
    const orgBundles = [
      makeRule({ name: "Org Labs", price: 50, targets: [{ serviceType: "labs", subType: null }] }),
      makeRule({ name: "Org Proc", price: 100, targets: [{ serviceType: "procedures", subType: null }] }),
    ];
    const locBundles = [
      makeRule({ name: "Loc Labs", price: 40, targets: [{ serviceType: "labs", subType: "cbc" }] }),
    ];

    const result = mergeLocationBundles(orgBundles, locBundles);

    // Org Labs replaced (overlaps on "labs"), Org Proc kept, Loc Labs added
    expect(result).toHaveLength(2);
    expect(result.find((r) => r.name === "Org Labs")).toBeUndefined();
    expect(result.find((r) => r.name === "Org Proc")).toBeDefined();
    expect(result.find((r) => r.name === "Loc Labs")).toBeDefined();
  });

  it("keeps org bundles that do not overlap with location bundles", () => {
    const orgBundles = [
      makeRule({ name: "Org DME", targets: [{ serviceType: "dme", subType: null }] }),
    ];
    const locBundles = [
      makeRule({ name: "Loc Labs", targets: [{ serviceType: "labs", subType: null }] }),
    ];

    const result = mergeLocationBundles(orgBundles, locBundles);

    expect(result).toHaveLength(2);
    expect(result.find((r) => r.name === "Org DME")).toBeDefined();
    expect(result.find((r) => r.name === "Loc Labs")).toBeDefined();
  });

  it("replaces all org bundles when location targets cover all org service types", () => {
    const orgBundles = [
      makeRule({ name: "Org", targets: [{ serviceType: "labs", subType: null }] }),
    ];
    const locBundles = [
      makeRule({ name: "Loc", targets: [{ serviceType: "labs", subType: null }] }),
    ];

    const result = mergeLocationBundles(orgBundles, locBundles);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Loc");
  });
});
