import sys

def patch():
    with open("app/components/OverviewHomepage.tsx", "r", encoding="utf-8") as f:
        content = f.read()
    
    # We want to replace the part of the code that renders the source cards.
    # Searching for:
    old_grid = """              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overview-source-grid" id="sourcesGrid">
                {props.sourceCards.length > 0 ? (
                  props.sourceCards.map((card) => (
                    <div key={card.key} className="glass-panel p-5 rounded-2xl flex flex-col justify-between hover:translate-y-[-2px] transition-all duration-300 relative overflow-hidden overview-source-card">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span className="text-xs font-black uppercase tracking-widest text-neutral-400 dark:text-neutral-500 font-mono">active</span>
                          </div>
                          <span className="text-xs font-bold text-neutral-400"><HtmlInline html={card.statusBadgeHtml} /></span>
                        </div>

                        <div>
                          <h4 className="font-black text-base font-mono text-neutral-900 dark:text-white mb-1 tracking-tight">{card.source}</h4>
                          <p className="text-xs text-neutral-400 dark:text-neutral-500 font-mono">ID: data-pipeline-{card.key}</p>
                        </div>
                      </div>

                      <div className="flex items-end justify-between border-t border-neutral-100 dark:border-neutral-800/80 pt-4 mt-6">
                        <div className="space-y-0.5 text-xs text-neutral-500 dark:text-neutral-400 w-full overflow-hidden">
                          <HtmlBlock html={card.metaPairsHtml} />
                        </div>
                      </div>
                    </div>
                  ))
                ) : ("""

    new_grid = """              <style>{`
                .source-health-meta .meta-pairs {
                  display: flex;
                  flex-direction: column;
                  gap: 0;
                }
                .source-health-meta .meta-pair {
                  display: flex;
                  justify-content: space-between;
                  width: 100%;
                  padding: 12px 16px;
                  background: transparent;
                  border: none;
                  border-radius: 0;
                  border-bottom: 1px dashed rgba(148, 163, 184, 0.2);
                  min-height: auto;
                  margin: 0;
                }
                .source-health-meta .meta-pair:last-child {
                  border-bottom: none;
                }
                .source-health-meta .meta-label {
                  font-weight: 500;
                  color: #64748b;
                  font-size: 12px;
                }
                .source-health-meta strong {
                  font-weight: 700;
                  color: #0f172a;
                  font-family: inherit;
                }
                .dark .source-health-meta strong {
                  color: #f8fafc;
                }
              `}</style>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overview-source-grid" id="sourcesGrid">
                {props.sourceCards.length > 0 ? (
                  props.sourceCards.map((card) => (
                    <div key={card.key} className="bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800 shadow-sm p-6 rounded-2xl flex flex-col justify-between hover:shadow-md transition-shadow duration-300 overview-source-card">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2 text-emerald-500 dark:text-emerald-400">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            <span className="text-[11px] font-bold uppercase tracking-widest font-mono">active</span>
                          </div>
                          <span className="text-xs font-bold text-neutral-400 badge-wrapper-card"><HtmlInline html={card.statusBadgeHtml.replace('accent', 'sage')} /></span>
                        </div>

                        <div className="pb-2">
                          <h4 className="font-bold text-base text-neutral-900 dark:text-white mb-2 tracking-tight">{card.source}</h4>
                          <p className="text-[11px] text-neutral-400 dark:text-neutral-500 font-mono">ID: data-pipeline-{card.key}</p>
                        </div>
                      </div>

                      <div className="mt-4 bg-slate-50/80 dark:bg-neutral-800/40 rounded-xl overflow-hidden shadow-inner border border-slate-100 dark:border-neutral-800">
                        <div className="w-full source-health-meta">
                          <HtmlBlock html={card.metaPairsHtml} />
                        </div>
                      </div>
                    </div>
                  ))
                ) : ("""
    
    if old_grid in content:
        content = content.replace(old_grid, new_grid)
        with open("app/components/OverviewHomepage.tsx", "w", encoding="utf-8") as f:
            f.write(content)
        print("Success")
    else:
        print("Failed to find block")

patch()
