import { redirect } from "next/navigation";

export default function PropertyPage({ params }: { params: { id: string } }) {
  redirect(`/properties/${params.id}/context`);
}
