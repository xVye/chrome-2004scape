const url = new URL('https://2004.lostcity.rs/client');

const WORLDS_CACHE_KEY: string = '2004scape_worlds';

export interface World {
    id: number;
    member: boolean;
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

                const cachedWorlds: World[] = result[WORLDS_CACHE_KEY].sort((a: World, b: World) => a.id - b.id);

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
        const response = await fetch('https://2004.lostcity.rs/serverlist?hires.x=101&hires.y=41&method=0');
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        let fetchedWorlds: World[] = [];
        totalPlayers = 0;

        const worldSections = doc.querySelectorAll('table[width="500"] > tbody > tr > td');
        for (const section of worldSections) {
            const headerText = section.querySelector('b')?.textContent?.trim();
            const isMember = headerText?.includes('p2p') || false;

            const worldTable = section.querySelector('table');
            if (!worldTable) {
                continue;
            }

            const rows = worldTable.querySelectorAll('tr');
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
                if (fetchedWorlds.some(w => w.id === world)) {
                    continue;
                }

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
                    member: isMember,
                    playerCount
                });
            }
        }

        // for (const table of tables) {
        //     const membertext = table.querySelector('b');
        //     const member = (membertext && membertext.textContent?.trim().match(/\s*p2p/)) != null;
        //     // const tables = parentTable.querySelectorAll('tbody > tr > td > table');

        //     const rows = table.querySelectorAll('tr');
        //     for (const row of rows) {
        //         const link = row.querySelector('a');
        //         if (!link) {
        //             continue;
        //         }

        //         const match = link.href.match(/world=(\d+)/);
        //         if (!match) {
        //             continue;
        //         }

        //         const world = parseInt(match[1], 10);
        //         const players = row.querySelector('td:last-child');
        //         if (!players) {
        //             continue;
        //         }

        //         const playersMatch = players.textContent?.trim().match(/(\d+)\s*players/);
        //         if (!playersMatch) {
        //             continue;
        //         }

        //         const playerCount = parseInt(playersMatch[1], 10);
        //         totalPlayers += playerCount;

        //         console.log(`World ${world} (${member ? 'P2P' : 'F2P'}): ${playerCount} players`);

        //         fetchedWorlds.push({
        //             id: world,
        //             member,
        //             playerCount
        //         });
        //     }
        // }

        fetchedWorlds = fetchedWorlds.sort((a, b) => a.id - b.id);
        await saveWorlds(fetchedWorlds);
        console.log(fetchedWorlds);
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
