import { create } from "zustand";

/**
 * File preview kinds supported by the file preview panel. Everything that is not
 * classified here falls back to the "open on disk" affordance.
 */
export type FilePreviewKind =
  | "markdown"
  | "plain-text"
  | "code"
  | "image"
  | "unsupported";

export interface FilePreviewHandle {
  /** Normalized absolute path (or `file://` resolved path) of the open file. */
  path: string;
  /** File basename, used for the header title and image alt text. */
  name: string;
  kind: FilePreviewKind;
  /** UTF-8 text content for markdown/plain-text/code previews. */
  content: string | null;
  /** Blob object URL for image previews. */
  objectUrl: string | null;
}

interface FilePreviewStore {
  file: FilePreviewHandle | null;
  loading: boolean;
  error: string | null;
  openFile: (handle: FilePreviewHandle) => void;
  setContent: (path: string, content: string) => void;
  setObjectUrl: (path: string, objectUrl: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (message: string | null) => void;
  clear: () => void;
}

export const useFilePreviewStore = create<FilePreviewStore>((set) => ({
  file: null,
  loading: false,
  error: null,
  openFile: (handle) =>
    set({
      file: handle,
      loading: false,
      error: null,
    }),
  setContent: (path, content) =>
    set((state) =>
      state.file?.path === path
        ? { file: { ...state.file, content, objectUrl: null } }
        : state,
    ),
  setObjectUrl: (path, objectUrl) =>
    set((state) => {
      if (state.file?.path !== path) {
        return state;
      }

      const previousUrl = state.file.objectUrl;
      if (previousUrl && previousUrl !== objectUrl && typeof URL !== "undefined") {
        URL.revokeObjectURL(previousUrl);
      }

      return { file: { ...state.file, objectUrl, content: null } };
    }),
  setLoading: (loading) => set({ loading }),
  setError: (message) => set({ error: message }),
  clear: () => set({ file: null, loading: false, error: null }),
}));

export function getFilePreviewState(): FilePreviewStore {
  return useFilePreviewStore.getState();
}