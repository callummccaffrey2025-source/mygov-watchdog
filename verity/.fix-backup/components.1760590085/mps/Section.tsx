import React from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";

type Props = {
  id?: string;
  title: string;
  children: React.ReactNode;
  className?: string;
};

export default function Section({ id, title, children, className }: Props) {
  return (
    <section id={id} className={className}>
      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold">{title}</h2>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </section>
  );
}
