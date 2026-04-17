"use client";
import ShareButtons from "@/components/utility/ShareButtons";
import FollowButton from "@/components/mps/FollowButton";
import PrintButton from "@/components/utility/PrintButton";

export default function MPActionsRow({
  slug, name, rssHref, emailHref,
}: { slug: string; name: string; rssHref: string; emailHref: string }) {
  return (
    <div className="mt-1 flex items-center justify-end gap-3">
      <ShareButtons title={name} />
      <FollowButton slug={slug} name={name} />
      <a href={rssHref} className="text-emerald-400 hover:underline">RSS</a>
      <a href={emailHref} className="text-emerald-400 hover:underline">Email office</a>
      <PrintButton />
    </div>
  );
}
