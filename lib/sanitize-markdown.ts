const FRANCHISE_NAMES = [
  "Morumbi", "Vila Mariana", "Santo Amaro", "Campo Belo",
  "Itaim Bibi", "Moema", "Brooklin", "Saúde",
  "Recife", "Fortaleza", "Salvador", "Curitiba",
];

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderSafeMarkdown(text: string): string {
  // 1. Escape all HTML entities in raw text first
  let html = escapeHtml(text);

  // 2. Apply safe markdown transformations on escaped text
  html = html
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/- (.*)/g, "<li>$1</li>")
    .replace(/(<li>.*<\/li>)+/g, "<ul class='list-disc pl-4 my-2'>$&</ul>")
    .replace(/\n/g, "<br/>");

  // 3. Highlight franchise names (already escaped, safe)
  FRANCHISE_NAMES.forEach((name) => {
    const escapedName = escapeHtml(name);
    const regex = new RegExp(`(Franquia |Franqueado )?\\b${escapedName}\\b`, "g");
    html = html.replace(
      regex,
      `<span class="inline-flex items-baseline gap-0.5 px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded font-medium text-[0.8em] border border-blue-100 whitespace-nowrap">$&</span>`
    );
  });

  return html;
}
