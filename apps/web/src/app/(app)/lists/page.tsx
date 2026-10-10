import { Suspense } from "react";
import { ListsView } from "../../../components/lists-view";

export default function ListsPage() {
  return (
    <Suspense>
      <ListsView />
    </Suspense>
  );
}
