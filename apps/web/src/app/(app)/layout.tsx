import { Header } from "../../components/header";
import { copy } from "../../lib/copy";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-10 focus:rounded-md focus:bg-canvas focus:px-4 focus:py-3"
      >
        {copy.nav.skip}
      </a>
      <Header />
      <main id="main">{children}</main>
    </>
  );
}
