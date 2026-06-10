import re

with open('app/components/OverviewHomepage.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Modify OverviewSourceCard type
type_old = """type OverviewSourceCard = {
  key: string;
  source: string;
  statusBadgeHtml: string;
  metaPairsHtml: string;
};"""

type_new = """type OverviewSourceCard = {
  key: string;
  source: string;
  statusBadgeHtml: string;
  metaPairsHtml: string;
  itemCount?: number;
  status?: string;
};"""

content = content.replace(type_old, type_new)

# Modify the card rendering
grid_old_pattern = r'<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overview-source-grid" id="sourcesGrid">.*?</div>\n            </div>\n          </div>'
grid_old = re.search(grid_old_pattern, content, re.DOTALL)
if not grid_old:
    print("Could not find grid!")
    exit(1)

grid_new = """<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overview-source-grid" id="sourcesGrid">
                {props.sourceCards.length > 0 ? (
                  props.sourceCards.map((card) => (
                    <div key={card.key} className="bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800 shadow-sm p-6 rounded-2xl flex flex-col justify-between hover:shadow-md transition-shadow duration-300 overview-source-card">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between pointer-events-none">
                          <div className="flex items-center space-x-2 text-emerald-500 dark:text-emerald-400">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            <span className="text-[11px] font-bold uppercase tracking-widest font-mono">active</span>
                          </div>
                          <span className="text-[11px] font-bold text-neutral-400 dark:text-neutral-500 tracking-widest font-mono">流水线联通</span>
                        </div>

                        <div className="pb-4">
                          <h4 className="font-bold text-base text-neutral-900 dark:text-white mb-2 tracking-tight font-mono">{card.source}</h4>
                          <p className="text-[11px] text-neutral-400 dark:text-neutral-500 font-mono">ID: data-pipeline-{card.key}</p>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-dashed border-neutral-200 dark:border-neutral-800/60 flex items-end justify-between">
                        <div>
                          <p className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 mb-1 tracking-widest">VOLUME COUNT</p>
                          <div className="flex items-baseline space-x-1">
                            <span className="text-xl font-bold font-mono text-neutral-800 dark:text-neutral-200 leading-none">{card.itemCount ?? 0}</span>
                            <span className="text-[11px] font-bold font-mono text-neutral-400 dark:text-neutral-500">DOCS</span>
                          </div>
                        </div>
                        <div>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-widest font-mono bg-indigo-50/80 text-indigo-500 border border-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20">{!card.status || card.status === 'active' ? 'PASS' : 'FAIL'}</span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs md:text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed col-span-3 empty-copy">{props.noneLabel}</p>
                )}
              </div>
            </div>
          </div>"""

content = content.replace(grid_old.group(0), grid_new)

with open('app/components/OverviewHomepage.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("OverviewHomepage.tsx patched successfully!")
