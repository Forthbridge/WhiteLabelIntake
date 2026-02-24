export const dynamic = "force-dynamic";

import { loadAllOnboardingData } from "@/lib/actions/onboarding";
import { OnboardingClient } from "@/components/form/OnboardingClient";

export default async function OnboardingPage() {
  const { sections, statuses, formStatus, phases, roles, networkLocationCount, sectionReviews, sellerData } = await loadAllOnboardingData();

  return (
    <OnboardingClient
      sectionData={sections}
      initialStatuses={statuses}
      formStatus={formStatus}
      phases={phases}
      roles={roles}
      networkLocationCount={networkLocationCount}
      sectionReviews={sectionReviews}
      sellerData={sellerData}
    />
  );
}
