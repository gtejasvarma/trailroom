import { loadPublishedCatalog } from "@trailroom/pipeline";
import { PublishedCatalog } from "../../components/published-catalog";
import { BuyProvider } from "../../components/buy-provider";
import { CompareProvider } from "../../components/compare-provider";
import { AccountProvider } from "../../components/account-provider";
import { JobProvider } from "../../components/job-provider";
import { ListsProvider } from "../../components/lists-provider";
import { MeProvider } from "../../components/me-provider";
import { Shell } from "../../components/shell";
import { ToastProvider } from "../../components/ui/toast";

// Pieces published after the static twelve come from Firestore, so nothing here is prerendered.
export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const published = await loadPublishedCatalog();
  return (
    <PublishedCatalog items={published}>
      <ToastProvider>
        <MeProvider>
          <ListsProvider>
            <JobProvider>
              <BuyProvider>
                <AccountProvider>
                  <CompareProvider>
                    <Shell>{children}</Shell>
                  </CompareProvider>
                </AccountProvider>
              </BuyProvider>
            </JobProvider>
          </ListsProvider>
        </MeProvider>
      </ToastProvider>
    </PublishedCatalog>
  );
}
