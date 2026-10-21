import { Injectable, signal } from '@angular/core';

export interface LolItem { id: string; name: string; image: string; stats: Record<string, number>; gold: number; desc: string }

// placeholder icons used by internal items with no real picture
const PLACEHOLDER_IMGS = new Set(['item0.png', 'item1.png']);
const STAT_MAP: Record<string, string> = {
  FlatHPPoolMod: 'hp', FlatMPPoolMod: 'mana', FlatPhysicalDamageMod: 'ad',
  FlatArmorMod: 'armor', FlatSpellBlockMod: 'mr', FlatMovementSpeedMod: 'ms',
};

function stripDesc(html: string): string {
  return (html || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * League of Legends items from Riot's Data Dragon (the latest version): only
 * ones on sale in the store, with a real icon, one per name. Loaded once,
 * the first time anything asks.
 */
@Injectable({ providedIn: 'root' })
export class LolItems {
  readonly items = signal<LolItem[] | null>(null);
  readonly byId = signal<Record<string, LolItem>>({});
  private version = '15.12.1';
  private loading: Promise<void> | null = null;

  load(): Promise<void> {
    if (this.loading) return this.loading;
    this.loading = (async () => {
      try {
        const versions = await fetch('https://ddragon.leagueoflegends.com/api/versions.json').then(r => r.json());
        this.version = versions[0];
        const raw = await fetch(`https://ddragon.leagueoflegends.com/cdn/${this.version}/data/en_US/item.json`).then(r => r.json());
        const list: LolItem[] = [], byId: Record<string, LolItem> = {};
        const seenImg = new Set<string>(), seenName = new Set<string>();
        for (const [id, item] of Object.entries(raw.data as Record<string, any>)) {
          if (!item.gold?.purchasable || item.inStore === false) continue;
          if (item.requiredChampion || item.requiredAlly || item.specialRecipe) continue;
          const img = item.image?.full;
          if (!img || PLACEHOLDER_IMGS.has(img) || seenImg.has(img) || seenName.has(item.name)) continue;
          seenImg.add(img);
          seenName.add(item.name);
          const entry: LolItem = { id, name: item.name, image: img, stats: item.stats || {}, gold: item.gold?.total || 0, desc: stripDesc(item.description) };
          list.push(entry);
          byId[id] = entry;
        }
        list.sort((a, b) => a.name.localeCompare(b.name));
        this.byId.set(byId);
        this.items.set(list);
      } catch (e) {
        console.warn('LoL items load error', e);
        this.items.set([]);
      }
    })();
    return this.loading;
  }

  image(file: string): string {
    return `https://ddragon.leagueoflegends.com/cdn/${this.version}/img/item/${file}`;
  }

  /** What a build adds to each stat; attack speed % is turned into a flat bonus on the base. */
  bonus(itemIds: (string | null)[], baseAs: number): Record<string, number> {
    const byId = this.byId(), out: Record<string, number> = {};
    let asPct = 0;
    for (const id of itemIds) {
      const it = id ? byId[id] : null;
      if (!it) continue;
      for (const [k, v] of Object.entries(it.stats)) {
        if (k === 'PercentAttackSpeedMod') { asPct += v; continue; }
        const mine = STAT_MAP[k];
        if (mine) out[mine] = (out[mine] || 0) + v;
      }
    }
    if (asPct) out['as'] = (out['as'] || 0) + (baseAs || 0.625) * asPct;
    return out;
  }
}
