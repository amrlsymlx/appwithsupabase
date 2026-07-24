const memoryStore = new Map<string, string>();

export async function setItem(key: string, value: string) {
  memoryStore.set(key, value);
}

export async function getItem(key: string) {
  return memoryStore.get(key) ?? null;
}

export async function deleteItem(key: string) {
  memoryStore.delete(key);
}

export async function setAuthSession(user: {
  email: string;
  name?: string | null;
}) {
  await setItem(
    "auth_session",
    JSON.stringify({
      authenticated: true,
      email: user.email,
      name: user.name ?? null,
    }),
  );
}

export async function getAuthSession() {
  const stored = await getItem("auth_session");

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
  await deleteItem("auth_session");
}
