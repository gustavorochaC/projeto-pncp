import { NoticeDetailView } from "@/components/notices/notice-detail-view";

export default async function NoticeDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <NoticeDetailView id={id} />;
}
