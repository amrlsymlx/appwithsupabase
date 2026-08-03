import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const memoryStore = new Map<string, string>();
const AUTH_SESSION_KEY = "auth_session";
const REMEMBERED_CREDENTIALS_KEY = "remembered_credentials";

function getPersistentStorage() {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }

  return null;
}

export async function setItem(key: string, value: string, persist = false) {
  if (!persist) {
    memoryStore.set(key, value);
    return;
  }

  if (Platform.OS === "web") {
    const storage = getPersistentStorage();
    if (storage) {
      storage.setItem(key, value);
      return;
    }
  } else {
    try {
      if (await SecureStore.isAvailableAsync()) {
        await SecureStore.setItemAsync(key, value);
        return;
      }
    } catch {
      // Fall back to in-memory storage when secure storage is unavailable.
    }
  }

  memoryStore.set(key, value);
}

export async function getItem(key: string) {
  if (memoryStore.has(key)) {
    return memoryStore.get(key) ?? null;
  }

  if (Platform.OS === "web") {
    const storage = getPersistentStorage();

    if (storage) {
      return storage.getItem(key) ?? null;
    }

    return null;
  }

  try {
    if (await SecureStore.isAvailableAsync()) {
      return await SecureStore.getItemAsync(key);
    }
  } catch {
    return null;
  }

  return null;
}

export async function deleteItem(key: string) {
  if (Platform.OS === "web") {
    const storage = getPersistentStorage();

    if (storage) {
      storage.removeItem(key);
    }
  } else {
    try {
      if (await SecureStore.isAvailableAsync()) {
        await SecureStore.deleteItemAsync(key);
      }
    } catch {
      // Ignore delete failures and still clear in-memory value.
    }
  }

  memoryStore.delete(key);
}

export async function setAuthSession(
  user: {
    email: string;
    name?: string | null;
    phoneNumber?: string | null;
    address?: string | null;
    username?: string | null;
    role?: string | null;
    avatarUri?: string | null;
    avatarLibraryKey?: string | null;
  },
  keepSignedIn = false,
) {
  await setItem(
    AUTH_SESSION_KEY,
    JSON.stringify({
      authenticated: true,
      email: user.email,
      name: user.name ?? null,
      phoneNumber: user.phoneNumber ?? null,
      address: user.address ?? null,
      username: user.username ?? null,
      role: user.role ?? null,
      avatarUri: user.avatarUri ?? null,
      avatarLibraryKey: user.avatarLibraryKey ?? null,
      rememberMe: keepSignedIn,
    }),
    keepSignedIn,
  );
}

export async function updateAuthSession(
  updates: Partial<{
    name: string | null;
    phoneNumber: string | null;
    address: string | null;
    username: string | null;
    role: string | null;
    avatarUri: string | null;
    avatarLibraryKey: string | null;
  }>,
) {
  const session = await getAuthSession();

  if (!session?.authenticated || !session?.email) {
    return;
  }

  await setAuthSession(
    {
      email: session.email,
      name: updates.name ?? session.name ?? null,
      phoneNumber: updates.phoneNumber ?? session.phoneNumber ?? null,
      address: updates.address ?? session.address ?? null,
      username: updates.username ?? session.username ?? null,
      role: updates.role ?? session.role ?? null,
      avatarUri: updates.avatarUri ?? session.avatarUri ?? null,
      avatarLibraryKey:
        updates.avatarLibraryKey ?? session.avatarLibraryKey ?? null,
    },
    Boolean(session.rememberMe),
  );
}

export async function getAuthSession() {
  const stored = await getItem(AUTH_SESSION_KEY);

  if (!stored) {
    return null;
  }

  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

export async function clearAuthSession() {
  await deleteItem(AUTH_SESSION_KEY);
}

export async function setRememberedCredentials(credentials: {
  email: string;
  password: string;
}) {
  await setItem(
    REMEMBERED_CREDENTIALS_KEY,
    JSON.stringify({
      email: credentials.email,
      password: credentials.password,
    }),
    true,
  );
}

export async function getRememberedCredentials(): Promise<{
  email: string;
  password: string;
} | null> {
  const stored = await getItem(REMEMBERED_CREDENTIALS_KEY);

  if (!stored) {
    return null;
  }

  try {
    const parsed = JSON.parse(stored) as {
      email?: string;
      password?: string;
    };

    if (
      typeof parsed.email === "string" &&
      typeof parsed.password === "string"
    ) {
      return {
        email: parsed.email,
        password: parsed.password,
      };
    }
  } catch {
    return null;
  }

  return null;
}

export async function clearRememberedCredentials() {
  await deleteItem(REMEMBERED_CREDENTIALS_KEY);
}
