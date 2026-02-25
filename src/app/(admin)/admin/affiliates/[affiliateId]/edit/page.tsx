export const dynamic = "force-dynamic";

import { loadAllOnboardingDataForAffiliate } from "@/lib/actions/onboarding";
import { OnboardingClient } from "@/components/form/OnboardingClient";
import { AdminFormProvider } from "@/lib/contexts/AdminFormContext";
import { notFound } from "next/navigation";
import Link from "next/link";

export default async function AdminEditPage({
  params,
}: {
  params: Promise<{ affiliateId: string }>;
}) {
  const { affiliateId } = await params;

  let data;
  try {
    data = await loadAllOnboardingDataForAffiliate(affiliateId);
  } catch {
    notFound();
  }

  return (
    <div>
      <div className="max-w-3xl mx-auto px-6 pt-4 pb-2">
        <Link
          href={`/admin/affiliates/${affiliateId}`}
          className="text-sm text-muted hover:text-brand-black"
        >
          &larr; Back to Client Detail
        </Link>
      </div>
      <AdminFormProvider affiliateId={affiliateId}>
        <OnboardingClient
          sectionData={data.sections}
          initialStatuses={data.statuses}
          affiliateId={affiliateId}
          phases={data.phases}
          formStatus={data.formStatus}
          roles={data.roles}
          networkLocationCount={data.networkLocationCount}
          sectionReviews={data.sectionReviews}
          sellerData={data.sellerData}
        />
      </AdminFormProvider>
    </div>
  );
}
