"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  softDeleteAffiliate,
  restoreAffiliate,
  softDeleteUser,
  unlockAffiliate,
  unlockPhaseForEditing,
  unlockSellerFlow,
  updateAffiliateRoles,
  listNetworkContracts,
  createNetworkContract,
  deleteNetworkContract,
  listSellers,
} from "@/lib/actions/admin";
import type { AffiliateDetail, PhaseStatus, NetworkContractItem, SellerFlowStatus } from "@/lib/actions/admin";
import type { CompletionStatus } from "@/types";

interface AffiliateDetailViewProps {
  affiliate: AffiliateDetail;
  statuses: Record<number, CompletionStatus>;
  phaseStatuses?: PhaseStatus[];
  sellerFlowStatus?: SellerFlowStatus | null;
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  COLLABORATOR: "Collaborator",
};

const PHASE_LABELS: Record<number, string> = {
  1: "Onboarding",
};

export function AffiliateDetailView({ affiliate, statuses, phaseStatuses = [], sellerFlowStatus }: AffiliateDetailViewProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [phaseAction, setPhaseAction] = useState<number | null>(null);

  const [unlockingSeller, setUnlockingSeller] = useState(false);

  // Role state
  const [isAffiliate, setIsAffiliate] = useState(affiliate.isAffiliate);
  const [isSeller, setIsSeller] = useState(affiliate.isSeller);
  const [mktEnabled, setMktEnabled] = useState(affiliate.marketplaceEnabled);
  const [savingRoles, setSavingRoles] = useState(false);
  const rolesChanged =
    isAffiliate !== affiliate.isAffiliate ||
    isSeller !== affiliate.isSeller ||
    mktEnabled !== affiliate.marketplaceEnabled;

  // Network contracts state
  const [contracts, setContracts] = useState<NetworkContractItem[]>([]);
  const [contractsLoaded, setContractsLoaded] = useState(false);
  const [showContractForm, setShowContractForm] = useState(false);
  const [sellers, setSellers] = useState<{ id: string; legalName: string | null }[]>([]);
  const [selectedSellerId, setSelectedSellerId] = useState("");
  const [contractNotes, setContractNotes] = useState("");
  const [creatingContract, setCreatingContract] = useState(false);

  // Auto-load contracts when affiliate is visible
  useEffect(() => {
    if (isAffiliate && !contractsLoaded) {
      loadContracts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAffiliate]);

  const totalSections = Object.keys(statuses).length;
  const completeSections = Object.values(statuses).filter((s) => s === "complete").length;
  const pct = totalSections > 0 ? Math.round((completeSections / totalSections) * 100) : 0;

  // Phase 1 status from phaseStatuses or fallback to affiliate.status
  const phase1 = phaseStatuses.find((p) => p.phase === 1);
  const phase1Status = phase1?.status ?? affiliate.status;

  async function handleDelete() {
    if (!confirm("Are you sure you want to soft-delete this affiliate and all its users?")) return;
    setDeleting(true);
    try {
      await softDeleteAffiliate(affiliate.id);
      router.push("/admin");
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  async function handleRestore() {
    await restoreAffiliate(affiliate.id);
    router.refresh();
  }

  async function handleUnlock() {
    if (!confirm("Unlock Phase 1? The client will be able to edit and re-submit.")) return;
    setUnlocking(true);
    try {
      await unlockAffiliate(affiliate.id);
      router.refresh();
    } finally {
      setUnlocking(false);
    }
  }

  async function handleUnlockPhaseForEditing(phaseNumber: number) {
    if (!confirm(`Unlock Phase ${phaseNumber} for editing? The client will be able to modify and re-submit.`)) return;
    setPhaseAction(phaseNumber);
    try {
      await unlockPhaseForEditing(affiliate.id, phaseNumber);
      router.refresh();
    } finally {
      setPhaseAction(null);
    }
  }

  async function handleDeleteUser(userId: string) {
    if (!confirm("Are you sure you want to remove this user?")) return;
    await softDeleteUser(userId);
    router.refresh();
  }

  async function handleSaveRoles() {
    if (!isAffiliate && !isSeller) {
      alert("Organization must have at least one role enabled.");
      return;
    }
    setSavingRoles(true);
    try {
      await updateAffiliateRoles(affiliate.id, { isAffiliate, isSeller, marketplaceEnabled: mktEnabled });
      router.refresh();
    } finally {
      setSavingRoles(false);
    }
  }

  async function handleUnlockSellerFlow() {
    if (!confirm("Unlock the seller (Care Delivery) flow? The client will be able to edit and re-submit.")) return;
    setUnlockingSeller(true);
    try {
      await unlockSellerFlow(affiliate.id);
      router.refresh();
    } finally {
      setUnlockingSeller(false);
    }
  }

  async function loadContracts() {
    const data = await listNetworkContracts(affiliate.id);
    setContracts(data);
    setContractsLoaded(true);
  }

  async function handleShowContractForm() {
    const sellerList = await listSellers();
    const existingSellerIds = new Set(contracts.map((c) => c.sellerId));
    setSellers(sellerList.filter((s) => s.id !== affiliate.id && !existingSellerIds.has(s.id)));
    setShowContractForm(true);
  }

  async function handleCreateContract() {
    if (!selectedSellerId) return;
    setCreatingContract(true);
    try {
      await createNetworkContract({
        affiliateId: affiliate.id,
        sellerId: selectedSellerId,
        notes: contractNotes || undefined,
      });
      setShowContractForm(false);
      setSelectedSellerId("");
      setContractNotes("");
      await loadContracts();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create contract");
    } finally {
      setCreatingContract(false);
    }
  }

  async function handleDeleteContract(contractId: string) {
    if (!confirm("Remove this network contract?")) return;
    await deleteNetworkContract(contractId);
    await loadContracts();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin" className="text-sm text-muted hover:text-brand-black mb-2 inline-block">
            &larr; Back to Clients
          </Link>
          <h1 className="text-2xl font-heading font-semibold text-brand-black">
            {affiliate.legalName || "Unnamed Client"}
          </h1>
        </div>
        <div className="flex gap-3">
          <Link href={`/admin/affiliates/${affiliate.id}/edit`}>
            <Button variant="cta">Edit Form</Button>
          </Link>
          {affiliate.deletedAt ? (
            <Button variant="secondary" onClick={handleRestore}>
              Restore
            </Button>
          ) : (
            <Button variant="secondary" onClick={handleDelete} loading={deleting}>
              Delete
            </Button>
          )}
        </div>
      </div>

      {/* Organization Roles */}
      <Card>
        <h2 className="font-heading font-semibold text-lg mb-4">Organization Roles</h2>
        <p className="text-xs text-muted mb-4">
          Controls which onboarding flows this organization sees. Dual-role orgs see both tabs.
        </p>
        <div className="flex gap-6 mb-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isAffiliate}
              onChange={(e) => setIsAffiliate(e.target.checked)}
              className="rounded border-border text-brand-teal focus:ring-brand-teal"
            />
            <span className="text-sm font-medium text-brand-black">Affiliate (Plan Buyer)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isSeller}
              onChange={(e) => setIsSeller(e.target.checked)}
              className="rounded border-border text-brand-teal focus:ring-brand-teal"
            />
            <span className="text-sm font-medium text-brand-black">Seller (Care Delivery)</span>
          </label>
        </div>
        {isAffiliate && (
          <div className="mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={mktEnabled}
                onChange={(e) => setMktEnabled(e.target.checked)}
                className="rounded border-border text-brand-teal focus:ring-brand-teal"
              />
              <span className="text-sm font-medium text-brand-black">Enable Marketplace</span>
            </label>
            <p className="text-xs text-muted ml-6 mt-0.5">
              Shows &quot;Show Marketplace&quot; toggle in Section 5 so affiliate can browse and add seller locations.
            </p>
          </div>
        )}
        {rolesChanged && (
          <Button variant="cta" onClick={handleSaveRoles} loading={savingRoles} className="px-4 py-2 text-sm">
            Save Roles
          </Button>
        )}
        {!isAffiliate && !isSeller && (
          <p className="text-xs text-error mt-2">At least one role must be enabled.</p>
        )}
      </Card>

      {/* Phase Progression */}
      <Card>
        <h2 className="font-heading font-semibold text-lg mb-4">Phase Progression</h2>
        <div className="flex flex-col gap-3">
          {/* Phase 1 */}
          <div className="flex items-center justify-between py-2 border-b border-border/50">
            <div className="flex items-center gap-3">
              <PhaseStatusBadge status={phase1Status} />
              <div>
                <span className="text-sm font-medium text-brand-black">Phase 1: {PHASE_LABELS[1]}</span>
                {phase1?.submittedAt && (
                  <p className="text-xs text-muted">Submitted {new Date(phase1.submittedAt).toLocaleDateString()}</p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              {phase1Status === "SUBMITTED" && (
                <Button variant="secondary" className="px-4 py-2 text-sm" onClick={handleUnlock} loading={unlocking}>
                  Unlock for Editing
                </Button>
              )}
            </div>
          </div>

        </div>
      </Card>

      {/* Seller Flow Status */}
      {affiliate.isSeller && (
        <Card>
          <h2 className="font-heading font-semibold text-lg mb-4">Seller Flow (Care Delivery)</h2>
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <PhaseStatusBadge status={sellerFlowStatus?.status ?? "DRAFT"} />
              <div>
                <span className="text-sm font-medium text-brand-black">Care Delivery Onboarding</span>
                {sellerFlowStatus?.submittedAt && (
                  <p className="text-xs text-muted">
                    Submitted {new Date(sellerFlowStatus.submittedAt).toLocaleDateString()}
                  </p>
                )}
                {!sellerFlowStatus && (
                  <p className="text-xs text-muted">Not yet submitted</p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              {sellerFlowStatus?.status === "SUBMITTED" && (
                <Button
                  variant="secondary"
                  className="px-4 py-2 text-sm"
                  onClick={handleUnlockSellerFlow}
                  loading={unlockingSeller}
                >
                  Unlock for Editing
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Completion Overview */}
      <Card>
        <h2 className="font-heading font-semibold text-lg mb-4">Completion</h2>
        <div className="flex items-center gap-4 mb-4">
          <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
            <div
              className="bg-brand-teal h-full rounded-full transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-sm font-medium text-brand-black">{pct}%</span>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {Object.entries(statuses).map(([id, status]) => (
            <div
              key={id}
              className={`text-center text-xs py-1.5 rounded ${
                status === "complete"
                  ? "bg-success/20 text-success"
                  : status === "in_progress"
                  ? "bg-warm-orange/20 text-warm-orange"
                  : "bg-gray-100 text-muted"
              }`}
            >
              S{id}
            </div>
          ))}
        </div>
      </Card>

      {/* Marketplace Visibility (only for affiliates) */}
      {isAffiliate && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading font-semibold text-lg">Marketplace Visibility</h2>
            <div className="flex gap-2">
              <Button variant="cta" className="px-4 py-2 text-sm" onClick={handleShowContractForm}>
                Add Visibility
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted mb-4">
            Controls which sellers/care delivery orgs are visible to this affiliate in the marketplace.
          </p>

          {contractsLoaded && contracts.length === 0 && !showContractForm && (
            <p className="text-sm text-muted">No marketplace visibility links yet.</p>
          )}

          {contractsLoaded && contracts.length > 0 && (
            <div className="space-y-2 mb-4">
              {contracts.map((contract) => (
                <div key={contract.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-brand-black">
                        {contract.sellerName || "Unnamed Seller"}
                      </span>
                      {contract.activeTermCount > 0 ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-success/20 text-success">
                          {contract.activeTermCount} active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700">
                          No active locations
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted">
                      {contract.totalLocationCount} location{contract.totalLocationCount !== 1 ? "s" : ""} available
                    </span>
                    {contract.notes && (
                      <p className="text-xs text-muted mt-0.5">{contract.notes}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeleteContract(contract.id)}
                    className="text-xs text-error hover:underline"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          {showContractForm && (
            <div className="border border-border rounded-lg p-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-brand-black mb-1">Seller</label>
                <select
                  value={selectedSellerId}
                  onChange={(e) => setSelectedSellerId(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Select a seller...</option>
                  {sellers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.legalName || "Unnamed"} ({s.id.slice(0, 8)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-brand-black mb-1">Notes (optional)</label>
                <input
                  type="text"
                  value={contractNotes}
                  onChange={(e) => setContractNotes(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm"
                  placeholder="e.g., Regional contract for Southeast"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="cta" className="px-4 py-2 text-sm" onClick={handleCreateContract} loading={creatingContract}>
                  Create Visibility Link
                </Button>
                <Button variant="secondary" className="px-4 py-2 text-sm" onClick={() => setShowContractForm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Users */}
      <Card>
        <h2 className="font-heading font-semibold text-lg mb-4">Users</h2>
        {affiliate.users.length === 0 ? (
          <p className="text-sm text-muted">No users.</p>
        ) : (
          <div className="space-y-3">
            {affiliate.users.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between py-2 border-b border-border last:border-0"
              >
                <div>
                  <span className="text-sm font-medium text-brand-black">
                    {user.name || "Unnamed"}
                  </span>
                  <span className="text-xs text-muted ml-2">
                    {user.email}
                  </span>
                  <span className="text-xs text-muted ml-2">
                    {ROLE_LABELS[user.role] ?? user.role}
                  </span>
                </div>
                <button
                  onClick={() => handleDeleteUser(user.id)}
                  className="text-xs text-error hover:underline"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function PhaseStatusBadge({ status }: { status: string }) {
  if (status === "SUBMITTED") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-success/20 text-success">
        Submitted
      </span>
    );
  }
  if (status === "DRAFT") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-warm-orange/20 text-warm-orange">
        In Progress
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-muted">
      Locked
    </span>
  );
}
