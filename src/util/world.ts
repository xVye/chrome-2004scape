const url = new URL('https://2004.lostcity.rs/client');

const WORLDS_CACHE_KEY: string = '2004scape_worlds';

export interface World {
    id: number;
    playerCount: number;
}

let totalPlayers: number = 0;
export const worlds = new Map<number, World>();

export function getTotalPlayers(): number {
    return totalPlayers;
}

async function saveWorlds(saveWorlds: World[]): Promise<void> {
    return new Promise(resolve => {
        chrome.storage.sync.set({ [WORLDS_CACHE_KEY]: saveWorlds }, () => {
            resolve();
        });
    });
}

export async function loadCachedWorlds(): Promise<void> {
    return new Promise((resolve, reject) => {
        try {
            chrome.storage.sync.get(WORLDS_CACHE_KEY, result => {
                if (!result[WORLDS_CACHE_KEY]) {
                    return reject();
                }

                const cachedWorlds: World[] = result[WORLDS_CACHE_KEY];

                worlds.clear();
                totalPlayers = 0;

                for (const world of cachedWorlds) {
                    worlds.set(world.id, world);
                    totalPlayers += world.playerCount;
                }
                resolve();
            });
        } catch (err) {
            reject(err);
        }
    });
}

export async function fetchWorlds(): Promise<World[] | undefined> {
    try {
        const resposne = await fetch('https://2004.lostcity.rs/serverlist?hires.x=101&hires.y=41&method=0');
        const html = await resposne.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        const fetchedWorlds: World[] = [];

        const tables = doc.querySelectorAll('table > tbody > tr > td > table');
        for (const table of tables) {
            const rows = table.querySelectorAll('tr');
            for (const row of rows) {
                const link = row.querySelector('a');
                if (!link) {
                    continue;
                }

                const match = link.href.match(/world=(\d+)/);
                if (!match) {
                    continue;
                }

                const world = parseInt(match[1], 10);
                const players = row.querySelector('td:last-child');
                if (!players) {
                    continue;
                }
                
                const playersMatch = players.textContent?.trim().match(/(\d+)\s*players/);
                if (!playersMatch) {
                    continue;
                }

                const playerCount = parseInt(playersMatch[1], 10);
                totalPlayers += playerCount;

                fetchedWorlds.push({
                    id: world,
                    playerCount,
                });
            }
        }
        
        await saveWorlds(fetchedWorlds);
        return fetchedWorlds;
    } catch (err) {
        console.error('Failed to load worlds:', err);
    }
}

export function toWorldUrl(world: number): string {
    if (!worlds.has(world)) {
        throw new Error(`Invalid world: ${world}`);
    }
    url.searchParams.set('world', world.toString());
    url.searchParams.set('detail', 'high');
    url.searchParams.set('method', '0');
    return url.toString();
}
