import { ListPage } from "../../../../components/list-page";

export default async function ListRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <ListPage listId={(await params).id} />;
}
