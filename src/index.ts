import '#/view/style.css';
import { worlds, toWorldUrl, fetchWorlds, loadCachedWorlds, World } from '#/util/world';

const worldsComponent = document.getElementById('worlds-component') as HTMLElement;
const worldListF2P = document.getElementById('worlds-f2p') as HTMLUListElement;
const worldListP2P = document.getElementById('worlds-p2p') as HTMLUListElement;
const createAccountPage = document.getElementById('create-account-page') as HTMLElement;
const createAccountUsername = document.getElementById('create-account-username') as HTMLInputElement;
const createAccountPassword = document.getElementById('create-account-password') as HTMLInputElement;
const createAccountSave = document.getElementById('create-account-save') as HTMLLinkElement;
const createAccountCancel = document.getElementById('create-account-cancel') as HTMLLinkElement;
const deleteAccountPage = document.getElementById('delete-account-page') as HTMLElement;
const deleteAccountUsername = document.getElementById('delete-account-username') as HTMLInputElement;
const deleteAccountDelete = document.getElementById('delete-account-delete') as HTMLLinkElement;
const deleteAccountCancel = document.getElementById('delete-account-cancel') as HTMLLinkElement;
const accountsComponent = document.getElementById('accounts-component') as HTMLElement;
const accounts = document.getElementById('accounts') as HTMLUListElement;
const controls = document.getElementById('controls') as HTMLUListElement;
const addAccount = document.getElementById('add-account') as HTMLLinkElement;
const deleteAccount = document.getElementById('delete-account') as HTMLLinkElement;

let AES_PASSWORD: string | null = null;
const AES_STORAGE_KEY: string = '2004scape_aes';
const LOCAL_STORAGE_KEY: string = '2004scape_accounts';

interface EncryptedData {
    iv: string;
    cipherText: string;
}

interface Account {
    username: string;
    encryptedData: EncryptedData;
    salt: string;
}

type Page = 'default' | 'create_account' | 'delete_account';
interface State {
    page: Page;
}

let accountsList: Account[] = [];

const state: State = {
    page: 'default'
};

async function generateAESPassword(): Promise<void> {
    return new Promise(resolve => {
        const availableKeys: string[] = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!"#¤%&/()=?@£$€{}[]-_.,'.split('');
        let password: string = '';

        for (let i = 0; i < 50; i++) {
            password += availableKeys[Math.floor(Math.random() * availableKeys.length)];
        }

        chrome.storage.sync.set({ [AES_STORAGE_KEY]: password }, () => {
            AES_PASSWORD = password;
            resolve();
        });
    });
}

async function loadAESPassword(): Promise<void> {
    return new Promise((resolve, reject) => {
        chrome.storage.sync.get(AES_STORAGE_KEY, data => {
            if (!data[AES_STORAGE_KEY]) {
                return reject('AES key not found.');
            }
            AES_PASSWORD = data[AES_STORAGE_KEY];
            resolve();
        });
    });
}

async function loadAccounts(): Promise<void> {
    return new Promise(resolve => {
        chrome.storage.sync.get(LOCAL_STORAGE_KEY, data => {
            if (!data[LOCAL_STORAGE_KEY]) {
                return resolve();
            }

            accountsList = data[LOCAL_STORAGE_KEY];
            updateAccounts();
            resolve();
        });
    });
}

function updateAccounts(): void {
    accounts.innerHTML = '';
    accountsList.forEach((account, id) => {
        const accountElement = document.createElement('li');
        const accountLink = document.createElement('a');

        accountLink.classList.add('button');
        accountLink.href = '#';
        accountLink.textContent = account.username;

        accountLink.addEventListener('click', () => {
            accountLogin(id);
        });

        accountElement.appendChild(accountLink);
        accounts.appendChild(accountElement);
    });
}

async function loadWorlds(fetchedWorlds: World[] | undefined): Promise<void> {
    if (!fetchedWorlds) {
        return;
    }

    const tempWorldListF2P = worldListF2P.cloneNode(true) as HTMLUListElement;
    const tempWorldListP2P = worldListP2P.cloneNode(true) as HTMLUListElement;
    
    for (const world of fetchedWorlds) {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = '#';
        a.textContent = world.id.toString();
        a.classList.add('bold');

        // Get current url
        const [tab] = await chrome.tabs.query({
            active: true,
            currentWindow: true
        });

        const currentUrl = new URL(tab.url || '');
        if (currentUrl.searchParams.get('world') === world.id.toString()) {
            a.style.color = 'red';
            a.style.cursor = 'default';
        }

        a.addEventListener('click', () => {
            if (!tab || !tab.url) {
                window.close();
                return;
            }

            if (currentUrl.searchParams.get('world') === world.id.toString()) {
                return;
            }

            const url = toWorldUrl(world.id);
            chrome.tabs.update({ url });
            window.close();
        });

        li.appendChild(a);
        if (world.member) {
            tempWorldListP2P.appendChild(li);
        }
        else {
            tempWorldListF2P.appendChild(li);
        }
    }

    worldListF2P.replaceWith(tempWorldListF2P);
    worldListP2P.replaceWith(tempWorldListP2P);
}

function updateState(): void {
    if (accountsList.length === 0) {
        state.page = 'create_account';
    }

    switch (state.page) {
        case 'default':
            createAccountPage.style.display = 'none';
            deleteAccountPage.style.display = 'none';
            worldsComponent.style.display = 'flex';
            accountsComponent.style.display = 'flex';
            accounts.style.display = 'flex';
            controls.style.display = 'flex';
            break;
        case 'create_account':
            createAccountPage.style.display = 'flex';
            deleteAccountPage.style.display = 'none';
            worldsComponent.style.display = 'none';
            accountsComponent.style.display = 'none';
            accounts.style.display = 'none';
            controls.style.display = 'none';
            break;
        case 'delete_account':
            createAccountPage.style.display = 'none';
            deleteAccountPage.style.display = 'flex';
            worldsComponent.style.display = 'none';
            accountsComponent.style.display = 'none';
            accounts.style.display = 'none';
            controls.style.display = 'none';
            break;
    }
}

addAccount.addEventListener('click', () => {
    state.page = 'create_account';
    updateState();
});

deleteAccount.addEventListener('click', () => {
    state.page = 'delete_account';
    updateState();
});

deleteAccountDelete.addEventListener('click', removeAccount);
deleteAccountCancel.addEventListener('click', () => {
    state.page = 'default';
    deleteAccountUsername.value = '';
    updateState();
});

createAccountSave.addEventListener('click', saveAccount);

createAccountCancel.addEventListener('click', () => {
    state.page = 'default';
    createAccountUsername.value = '';
    createAccountPassword.value = '';
    updateState();
});

async function saveAccount(): Promise<void> {
    const username = createAccountUsername.value;
    const password = createAccountPassword.value;

    if (!username || !password) {
        return;
    }

    if (accountsList.some(account => account.username.toLowerCase() === username.toLowerCase())) {
        return;
    }

    createAccountUsername.value = '';
    createAccountPassword.value = '';

    const encryptedCredentials = await getEncryptedCredentials(username, password);
    chrome.storage.sync.set({ [LOCAL_STORAGE_KEY]: [...accountsList, encryptedCredentials] });

    state.page = 'default';

    await loadAccounts();
    updateState();
}

async function removeAccount(): Promise<void> {
    const username = deleteAccountUsername.value;

    if (!username) {
        return;
    }

    deleteAccountUsername.value = '';

    const accountIndex = accountsList.findIndex(account => account.username.toLowerCase() === username.toLowerCase());

    if (accountIndex === -1) {
        return;
    }

    accountsList.splice(accountIndex, 1);
    chrome.storage.sync.set({ [LOCAL_STORAGE_KEY]: accountsList });

    state.page = 'default';
    await loadAccounts();
    updateState();
}

async function accountLogin(id: number): Promise<void> {
    try {
        const account = accountsList[id];
        if (!account) {
            return;
        }

        const [tab] = await chrome.tabs.query({
            active: true,
            currentWindow: true
        });

        if (!tab || !tab.id) {
            console.error('No active tab found.');
            return;
        }

        const allowed = /^https?:\/\/([^.]+\.)?lostcity\.rs(\/|$)/.test(tab.url || '');
        if (!allowed) {
            alert('This extension only works on *.lostcity.rs');
            return;
        }

        const decryptedAccount = await getDecryptedCredentials(id);
        if (!decryptedAccount) {
            console.error('Failed to decrypt account.');
            return;
        }

        // Inject the script into all frames (including cross-origin frames)
        await chrome.scripting.executeScript({
            target: { tabId: tab.id, allFrames: true },
            func: injectKeyEvent,
            args: [decryptedAccount.username, decryptedAccount.password]
        });
        window.close();
    } catch (error) {
        console.error('Error injecting script:', error);
    }
}

function injectKeyEvent(user: string, pass: string): void {
    const username = user.split('');
    const password = pass.split('');
    const canvas = document.getElementById('canvas');

    if (canvas) {
        for (let i = 0; i < username.length; i++) {
            canvas.dispatchEvent(
                new KeyboardEvent('keydown', {
                    key: username[i],
                    code: username[i].charCodeAt(0).toString()
                })
            );
        }

        canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: '13' }));

        for (let i = 0; i < password.length; i++) {
            canvas.dispatchEvent(
                new KeyboardEvent('keydown', {
                    key: password[i],
                    code: password[i].charCodeAt(0).toString()
                })
            );
        }
    }
}

async function getEncryptedCredentials(username: string, password: string): Promise<Account> {
    const salt = crypto.getRandomValues(new Uint8Array(16));

    // Derive an encryption key from the master password and salt
    const key = await deriveKeyFromPassword(salt);

    const encryptedData = await encryptText(password, key);

    return {
        username,
        encryptedData,
        salt: bufferToBase64(salt)
    };
}

async function getDecryptedCredentials(id: number): Promise<{ username: string; password: string } | undefined> {
    const account = accountsList[id];
    if (!account) {
        return undefined;
    }

    const { username, encryptedData: password, salt } = account;

    // Convert the stored salt back to an ArrayBuffer
    const saltBuffer = new Uint8Array(base64ToBuffer(salt));

    // Derive the same key using the provided master password and stored salt
    const key = await deriveKeyFromPassword(saltBuffer);

    // Decrypt username and password
    const decryptedPassword = await decryptText(password, key);
    return { username, password: decryptedPassword };
}

async function encryptText(plainText: string, key: CryptoKey): Promise<EncryptedData> {
    const encoder = new TextEncoder();
    // Generate a random 12-byte initialization vector (IV)
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Encrypt the plainText
    const cipherBuffer = await crypto.subtle.encrypt(
        {
            name: 'AES-GCM',
            iv: iv
        },
        key,
        encoder.encode(plainText)
    );

    return {
        iv: bufferToBase64(iv),
        cipherText: bufferToBase64(cipherBuffer)
    };
}

async function decryptText(encryptedData: EncryptedData, key: CryptoKey): Promise<string> {
    const { iv: ivBase64, cipherText: cipherBase64 } = encryptedData;
    const iv = new Uint8Array(base64ToBuffer(ivBase64));
    const cipherBuffer = base64ToBuffer(cipherBase64);

    const decryptedBuffer = await crypto.subtle.decrypt(
        {
            name: 'AES-GCM',
            iv: iv
        },
        key,
        cipherBuffer
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
}

async function deriveKeyFromPassword(saltBuffer: Uint8Array): Promise<CryptoKey> {
    if (!AES_PASSWORD) {
        throw new Error('AES password not set.');
    }

    const encoder = new TextEncoder();
    // Import the raw password as key material
    const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(AES_PASSWORD), 'PBKDF2', false, ['deriveKey']);

    // Derive a key using PBKDF2
    return crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: saltBuffer,
            iterations: 100000, // Increase iterations for more security (adjust as needed)
            hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
    );
}

function bufferToBase64(buffer: ArrayBuffer | Uint8Array<ArrayBuffer>): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

function base64ToBuffer(base64: string): ArrayBuffer {
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

(async () => {
    try {
        await loadAESPassword();
    } catch {
        await generateAESPassword();
    }

    try {
        await loadAccounts();
        await loadCachedWorlds();
        await loadWorlds(Array.from(worlds.values()));

        fetchWorlds()
            .then(async fetchedWorlds => await loadWorlds(fetchedWorlds))
            .catch(err => console.error('Failed to load worlds:', err));

        updateState();
    } catch (err) {
        throw new Error(`${err}`);
    }
})();
