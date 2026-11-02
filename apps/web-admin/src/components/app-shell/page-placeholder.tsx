"use client";

import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@cleanhub/ui";
import { useWebAdminLocale } from "@/i18n";

type PagePlaceholderProps = {
  page: "home" | "apiHealth";
};

export function PagePlaceholder({ page }: PagePlaceholderProps) {
  const { messages } = useWebAdminLocale();
  const { title, description, items } = messages.utilityPages[page];
  return (
    <section className="p-6">
      <div className="max-w-6xl">
        <Badge variant="secondary">{messages.saas.common.badge}</Badge>
        <h1 className="mt-4 text-2xl font-semibold">{title}</h1>
        {description ? (
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        ) : null}
        {items.length > 0 ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {items.map((item) => (
              <Card className="rounded-lg py-0" key={item}>
                <CardHeader className="px-4 py-4">
                  <CardTitle className="text-sm">{item}</CardTitle>
                  <CardDescription>
                    {messages.saas.common.modulePlaceholder}
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="h-2 rounded bg-muted" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
