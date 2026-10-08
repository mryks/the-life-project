---
name: obsidian-vault
description: Maintain and update the root Obsidian-style memory vault in memory/ with bi-directional wikilinks, domain notes, and step logs.
---

# Obsidian Memory Vault Maintenance

This skill guides the AI assistant in maintaining the Obsidian-compatible knowledge vault located at `memory/` in the project root.

## Core Rules

1. **Vault Location**: `memory/` in the project root folder.
2. **Atlas Hub**: `memory/00 - Atlas (Index).md` is the central Map of Content (MOC). Any new note must be referenced here.
3. **Wikilinking**: Use `[[Note Name]]` wikilinks as well as standard markdown links when referencing other documents in the vault.
4. **Evergreen Notes**: Keep domain notes (Financial Model, Cloud Sync, Security, UI System, Deployment) updated as the implementation progresses.
5. **Changelog**: Log every completed step, user feedback, and architectural decision in `memory/Changelog & Step Log.md`.
6. **No Stale Information**: When code rules change (e.g. new types, new sync triggers, bugfixes), immediately reflect the change in the corresponding vault note.
