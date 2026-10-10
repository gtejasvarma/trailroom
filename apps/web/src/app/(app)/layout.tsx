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
            <AccountProvider>
              <Shell>{children}</Shell>
            </AccountProvider>
          </JobProvider>
        </ListsProvider>
      </MeProvider>
    </ToastProvider>
  );
}
