/**
 * Bundle pricing resolution logic.
 *
 * Given a set of bundle rules and visit items, determines which bundles apply,
 * resolves overlaps using most-specific-wins, and computes final pricing.
 */

export interface BundleRuleWithTargets {
  name: string;
  ruleType: "flat_rate";
  price: number;
  includesVisitFee: boolean;
  targets: Array<{ serviceType: string; subType: string | null }>;
}

export interface VisitItem {
  serviceType: string;
  subType?: string;
  unitPrice: number | null;
}

export interface AppliedBundle {
  name: string;
  ruleType: "flat_rate";
  price: number;
  includesVisitFee: boolean;
  coveredItems: Array<{ serviceType: string; subType?: string }>;
}

export interface BundleResolutionResult {
  appliedBundles: AppliedBundle[];
  unbundledItems: VisitItem[];
  visitFeeAbsorbed: boolean;
}

/**
 * Check if a bundle target matches a visit item.
 * Category target (subType == null) matches any item of that serviceType.
 * Sub-service target requires exact serviceType + subType match.
 */
function targetMatchesItem(
  target: { serviceType: string; subType: string | null },
  item: VisitItem,
): boolean {
  if (target.serviceType !== item.serviceType) return false;
  if (target.subType == null) return true; // category-level match
  return target.subType === (item.subType ?? null);
}

/**
 * Compute specificity score for a rule relative to the items it matches.
 * Sub-service target = 2 pts, category target = 1 pt; summed across targets.
 */
function computeSpecificity(rule: BundleRuleWithTargets): number {
  let score = 0;
  for (const t of rule.targets) {
    score += t.subType != null ? 2 : 1;
  }
  return score;
}

/**
 * Merge location-specific bundles with org-wide bundles.
 * Location bundles replace org-wide bundles that target any of the same categories.
 */
export function mergeLocationBundles(
  orgBundles: BundleRuleWithTargets[],
  locationBundles: BundleRuleWithTargets[],
): BundleRuleWithTargets[] {
  if (locationBundles.length === 0) return orgBundles;

  // Collect all serviceTypes targeted by location bundles
  const locTargetedTypes = new Set<string>();
  for (const lb of locationBundles) {
    for (const t of lb.targets) {
      locTargetedTypes.add(t.serviceType);
    }
  }

  // Keep org bundles that don't overlap with location bundles
  const kept = orgBundles.filter((ob) =>
    !ob.targets.some((t) => locTargetedTypes.has(t.serviceType))
  );

  return [...kept, ...locationBundles];
}

/**
 * Resolve bundle rules against visit items.
 */
export function resolveBundleRules(
  bundleRules: BundleRuleWithTargets[],
  visitItems: VisitItem[],
): BundleResolutionResult {
  if (bundleRules.length === 0 || visitItems.length === 0) {
    return { appliedBundles: [], unbundledItems: [...visitItems], visitFeeAbsorbed: false };
  }

  // 1. For each rule, find which items it matches
  const ruleMatches = bundleRules.map((rule) => ({
    rule,
    matchedItems: visitItems.filter((item) =>
      rule.targets.some((t) => targetMatchesItem(t, item))
    ),
    specificity: computeSpecificity(rule),
  }));

  // Filter out rules with no matches
  const applicableRules = ruleMatches.filter((rm) => rm.matchedItems.length > 0);

  // 2. Sort by specificity DESC (most specific rules claim items first)
  applicableRules.sort((a, b) => b.specificity - a.specificity);

  // 3. Greedily assign items to rules (most-specific-wins)
  const claimedItems = new Set<number>(); // indices into visitItems
  const appliedBundles: AppliedBundle[] = [];

  for (const { rule, matchedItems } of applicableRules) {
    // Filter to unclaimed items
    const unclaimed = matchedItems.filter((item) => {
      const idx = visitItems.indexOf(item);
      return !claimedItems.has(idx);
    });

    if (unclaimed.length === 0) continue;

    // Claim items
    const coveredItems: AppliedBundle["coveredItems"] = [];

    // All matched unclaimed items are covered at flat rate
    for (const item of unclaimed) {
      claimedItems.add(visitItems.indexOf(item));
      coveredItems.push({ serviceType: item.serviceType, subType: item.subType });
    }

    appliedBundles.push({
      name: rule.name,
      ruleType: rule.ruleType,
      price: rule.price,
      includesVisitFee: rule.includesVisitFee,
      coveredItems,
    });
  }

  // 4. Collect unbundled items
  const unbundledItems = visitItems.filter((_, idx) => !claimedItems.has(idx));

  // 5. Check if any applied bundle absorbs the visit fee
  const visitFeeAbsorbed = appliedBundles.some((b) => b.includesVisitFee);

  return { appliedBundles, unbundledItems, visitFeeAbsorbed };
}
