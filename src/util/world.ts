const url = new URL('https://2004.lostcity.rs/client');

export const worlds: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export function toWorldUrl(world: number): string {
    if (worlds.indexOf(world) === -1) {
        throw new Error(`Invalid world: ${world}`);
    }
    url.searchParams.set('world', world.toString());
    url.searchParams.set('detail', 'high');
    url.searchParams.set('method', '0');
    return url.toString();
}
