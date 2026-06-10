import type { KbCardSections } from "./types.ts";

function trimBody(lines: string[]): string[] {
  let start = 0;
  let end = lines.length - 1;
  while (start <= end && lines[start]?.trim().length === 0) start += 1;
  while (end >= start && lines[end]?.trim().length === 0) end -= 1;
  return start > end ? [] : lines.slice(start, end + 1);
}

export function parseKnowledgeCardMarkdown(markdown: string): KbCardSections {
  const lines = markdown.split(/\r?\n/);
  const machine_sections: KbCardSections["machine_sections"] = [];
  const human_sections: KbCardSections["human_sections"] = [];
  let currentTitle: string | null = null;
  let currentBody: string[] = [];
  let inHumanSection = false;

  const pushCurrent = () => {
    if (!currentTitle) return;
    const body = trimBody(currentBody);
    if (body.length === 0) return;
    const target = inHumanSection ? human_sections : machine_sections;
    target.push({ title: currentTitle, body });
  };

  for (const line of lines) {
    if (/^##\s+/.test(line)) {
      pushCurrent();
      currentTitle = line.replace(/^##\s+/, "").trim();
      currentBody = [];
      if (
        /^(review notes|human notes|人工判断|人工区)$/i.test(currentTitle) ||
        machine_sections.some((section) => /^(next actions|下一步|后续动作)$/i.test(section.title))
      ) {
        inHumanSection = true;
      }
      continue;
    }
    if (currentTitle) currentBody.push(line);
  }
  pushCurrent();

  return { machine_sections, human_sections };
}
