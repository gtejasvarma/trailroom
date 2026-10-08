import { MeProvider } from "../../components/me-provider";
import { Shell } from "../../components/shell";
import { ToastProvider } from "../../components/ui/toast";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <MeProvider>
        <Shell>{children}</Shell>
      </MeProvider>
    </ToastProvider>
  );
}
