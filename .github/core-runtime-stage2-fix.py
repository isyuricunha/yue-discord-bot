from pathlib import Path

autorole_path = Path('apps/bot/src/services/autorole.service.ts')
autorole = autorole_path.read_text()
bad = '''\n  }\n\n  private async get_guild_config(guild_id: string): Promise<autorole_config> {\n    return this.config_cache.get(guild_id)\n  }\n'''
good = '''\n  private async get_guild_config(guild_id: string): Promise<autorole_config> {\n    return this.config_cache.get(guild_id)\n  }\n'''
if bad not in autorole:
    raise SystemExit('staged autorole extra brace not found')
autorole_path.write_text(autorole.replace(bad, good, 1))

xp_path = Path('apps/bot/src/services/xp.service.ts')
xp = xp_path.read_text()
old = '    this.config_cache.delete(guild_id)\n'
new = '    this.config_cache.invalidate(guild_id)\n'
if old not in xp:
    raise SystemExit('staged xp cache delete not found')
xp_path.write_text(xp.replace(old, new, 1))
