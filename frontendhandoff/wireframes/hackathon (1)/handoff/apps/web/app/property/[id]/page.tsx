import { redirect } from "next/navigation";

export default function PropertyIndex({ params }: { params: { id: string } }) {
  redirect(`/property/${params.id}/tickets`);
}
