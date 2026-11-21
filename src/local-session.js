/** Store a single explicitly saved workspace, scoped to this browser and site. */
export async function localSession(mode, value) {
  const request = indexedDB.open('stamp-art-print-lab', 1);
  request.onupgradeneeded = () => request.result.createObjectStore('sessions');
  const db = await new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Cierra las otras pestañas del taller e inténtalo de nuevo.'));
  });
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction('sessions', mode === 'load' ? 'readonly' : 'readwrite');
      const store = transaction.objectStore('sessions');
      const operation = mode === 'load' ? store.get('workspace') :
        mode === 'save' ? store.put(value, 'workspace') : store.delete('workspace');
      transaction.oncomplete = () => resolve(operation.result);
      transaction.onabort = () => reject(transaction.error ?? new Error('Se interrumpió el guardado local.'));
      transaction.onerror = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}
