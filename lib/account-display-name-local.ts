/** Nome de exibição guardado no browser (ex.: admin só com APP_PASSWORD, sem linha em app-data). */
export function accountFullNameStorageKey(email: string): string {
  return `ai-chat-account-fullname:${email.trim().toLowerCase()}`;
}

export function readAccountFullNameFromLocalStorage(email: string): string {
  if (typeof window === "undefined" || !email.trim()) return "";
  try {
    return localStorage.getItem(accountFullNameStorageKey(email))?.trim() ?? "";
  } catch {
    return "";
  }
}

export function writeAccountFullNameToLocalStorage(email: string, fullName: string): void {
  try {
    const v = fullName.trim();
    if (v) localStorage.setItem(accountFullNameStorageKey(email), v);
    else localStorage.removeItem(accountFullNameStorageKey(email));
  } catch {
    /* ignore */
  }
}
