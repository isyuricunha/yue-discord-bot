from pathlib import Path

path = Path('apps/bot/src/services/autorole.service.ts')
text = path.read_text()
bad = '''\n  }\n\n  private async get_guild_config(guild_id: string): Promise<autorole_config> {\n    return this.config_cache.get(guild_id)\n  }\n'''
good = '''\n  private async get_guild_config(guild_id: string): Promise<autorole_config> {\n    return this.config_cache.get(guild_id)\n  }\n'''
if bad not in text:
    raise SystemExit('staged autorole extra brace not found')
path.write_text(text.replace(bad, good, 1))
