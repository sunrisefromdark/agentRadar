with open('app/server.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace all occurrences of sourceCards construction
old_source_cards = """    sourceCards: sourceItems.map((item) => ({
      key: item.source,
      source: item.source,
      statusBadgeHtml: badge(readableText(localizeFieldValue(item.status, lang), uiText(lang, "启用", "active")), item.status === "active" ? "sage" : "accent"),
      metaPairsHtml: renderMetaPairs([
        { label: ui.enabledLabel, value: localizeBoolean(item.enabled, lang), tone: item.enabled ? "sage" : "neutral" },
        { label: ui.countLabel, value: String(item.item_count), tone: "neutral" },
      ]),
    })),"""

new_source_cards = """    sourceCards: sourceItems.map((item) => ({
      key: item.source,
      source: item.source,
      statusBadgeHtml: badge(readableText(localizeFieldValue(item.status, lang), uiText(lang, "启用", "active")), item.status === "active" ? "sage" : "accent"),
      metaPairsHtml: renderMetaPairs([
        { label: ui.enabledLabel, value: localizeBoolean(item.enabled, lang), tone: item.enabled ? "sage" : "neutral" },
        { label: ui.countLabel, value: String(item.item_count), tone: "neutral" },
      ]),
      itemCount: item.item_count,
      status: item.status,
    })),"""

content = content.replace(old_source_cards, new_source_cards)

old_source_cards_2 = """    sourceCards: sourceItems.map((item) => ({
      key: item.source,
      source: item.source,
      statusBadgeHtml: badge(localizeFieldValue(item.status, lang), item.status === "active" ? "sage" : "accent"),
      metaPairsHtml: renderMetaPairs([
        { label: ui.enabledLabel, value: localizeBoolean(item.enabled, lang), tone: item.enabled ? "sage" : "neutral" },
        { label: ui.countLabel, value: String(item.item_count), tone: "neutral" },
      ]),
    })),"""

new_source_cards_2 = """    sourceCards: sourceItems.map((item) => ({
      key: item.source,
      source: item.source,
      statusBadgeHtml: badge(localizeFieldValue(item.status, lang), item.status === "active" ? "sage" : "accent"),
      metaPairsHtml: renderMetaPairs([
        { label: ui.enabledLabel, value: localizeBoolean(item.enabled, lang), tone: item.enabled ? "sage" : "neutral" },
        { label: ui.countLabel, value: String(item.item_count), tone: "neutral" },
      ]),
      itemCount: item.item_count,
      status: item.status,
    })),"""

content = content.replace(old_source_cards_2, new_source_cards_2)
old_source_cards_3 = """      sourceCards: sourceItems.map((item) => ({
        key: item.source,
        source: item.source,
        statusBadgeHtml: badge(localizeFieldValue(item.status, lang), item.status === "active" ? "sage" : "accent"),
        metaPairsHtml: renderMetaPairs([
          { label: ui.enabledLabel, value: localizeBoolean(item.enabled, lang), tone: item.enabled ? "sage" : "neutral" },
          { label: ui.countLabel, value: String(item.item_count), tone: "neutral" },
        ]),
      })),"""
new_source_cards_3 = """      sourceCards: sourceItems.map((item) => ({
        key: item.source,
        source: item.source,
        statusBadgeHtml: badge(localizeFieldValue(item.status, lang), item.status === "active" ? "sage" : "accent"),
        metaPairsHtml: renderMetaPairs([
          { label: ui.enabledLabel, value: localizeBoolean(item.enabled, lang), tone: item.enabled ? "sage" : "neutral" },
          { label: ui.countLabel, value: String(item.item_count), tone: "neutral" },
        ]),
        itemCount: item.item_count,
        status: item.status,
      })),"""
content = content.replace(old_source_cards_3, new_source_cards_3)

with open('app/server.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("server.ts patched successfully!")
