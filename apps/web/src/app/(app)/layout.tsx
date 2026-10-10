import { BuyProvider } from "../../components/buy-provider";
import { CompareProvider } from "../../components/compare-provider";
import { AccountProvider } from "../../components/account-provider";
import { JobProvider } from "../../components/job-provider";
import { ListsProvider } from "../../components/lists-provider";
import { MeProvider } from "../../components/me-provider";
import { Shell } from "../../components/shell";
import { ToastProvider } from "../../components/ui/toast";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
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
  );
}
