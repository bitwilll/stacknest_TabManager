// Foundational storage layer over chrome.storage.local with a single serialized
// write queue. Every read-modify-write runs through `update()` so two mutations
// dispatched close together can't each read the same snapshot and clobber one
// another (the concurrent-write data-loss race).

let chain = Promise.resolve();

// Run fn() only after every previously-queued op settles (in order). Errors in one
// queued op don't break the chain for the next.
export function queued(fn) {
  const run = chain.then(fn, fn);
  chain = run.then(() => {}, () => {});
  return run;
}

export async function getKey(key, fallback = null) {
  try {
    const data = await chrome.storage.local.get(key);
    return key in data && data[key] !== undefined ? data[key] : fallback;
  } catch {
    return fallback;
  }
}

export async function setKey(key, value) {
  await chrome.storage.local.set({ [key]: value });
}

// Serialized read-modify-write of one key. `fn(current)` returns the value to
// persist (return `undefined` to leave it unchanged). Resolves to fn's return.
export function update(key, fallback, fn) {
  return queued(async () => {
    const current = await getKey(key, fallback);
    const next = await fn(current);
    if (next !== undefined) await setKey(key, next);
    return next;
  });
}
