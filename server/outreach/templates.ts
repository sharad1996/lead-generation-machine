export { DEFAULT_WEB_PRESENCE_TEMPLATE } from "@/lib/outreach-templates";

export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
}
