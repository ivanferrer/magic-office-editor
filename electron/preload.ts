import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('magic', {
    open: () => ipcRenderer.invoke('document:open'),
    save: (document: unknown, saveAs: boolean) =>
        ipcRenderer.invoke('document:save', document, saveAs),
    exportDocx: (document: unknown) => ipcRenderer.invoke('document:docx', document),
    exportText: (text: string, title: string) => ipcRenderer.invoke('document:text', text, title),
    pdf: (html: string, document: unknown) => ipcRenderer.invoke('document:pdf', html, document),
    print: (html: string, document: unknown) =>
        ipcRenderer.invoke('document:print', html, document),
    image: () => ipcRenderer.invoke('document:image'),
    autosave: (document: unknown) => ipcRenderer.invoke('document:autosave', document),
    history: () => ipcRenderer.invoke('document:history'),
    restore: (id: string) => ipcRenderer.invoke('document:restore', id),
    newDocument: () => ipcRenderer.invoke('document:new'),
    settings: () => ipcRenderer.invoke('ai:settings'),
    saveSettings: (settings: unknown) => ipcRenderer.invoke('ai:save-settings', settings),
    testConnection: () => ipcRenderer.invoke('ai:test'),
    review: (request: unknown) => ipcRenderer.invoke('ai:review', request),
    cancelReview: () => ipcRenderer.invoke('ai:cancel'),
    setDirty: (dirty: boolean) => ipcRenderer.send('document:dirty', dirty),
    onClose: (callback: () => void) => {
        const listener = () => callback();
        ipcRenderer.on('window:request-close', listener);
        return () => ipcRenderer.removeListener('window:request-close', listener);
    },
    finishClose: () => ipcRenderer.invoke('window:close'),
});
