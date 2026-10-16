export type ExistingDesktopWindow = {
  isDestroyed(): boolean;
  isMinimized(): boolean;
  restore(): void;
  show(): void;
  focus(): void;
};

export type DesktopSingleInstanceOptions = {
  requestLock(): boolean;
  quit(): void;
  onSecondInstance(listener: () => void): void;
  getMainWindow(): ExistingDesktopWindow | null;
};

export function focusExistingDesktopWindow(
  window: ExistingDesktopWindow | null,
): boolean {
  if (!window || window.isDestroyed()) {
    return false;
  }

  if (window.isMinimized()) {
    window.restore();
  }
  window.show();
  window.focus();
  return true;
}

/**
 * Electron processes do not share renderer Web Locks or the in-process
 * offline-storage mutex. One process per userData directory keeps queue
 * read-modify-write and physical hardware execution single-writer.
 */
export function acquireDesktopSingleInstance(
  options: DesktopSingleInstanceOptions,
): boolean {
  if (!options.requestLock()) {
    options.quit();
    return false;
  }

  options.onSecondInstance(() => {
    focusExistingDesktopWindow(options.getMainWindow());
  });
  return true;
}
