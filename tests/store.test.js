const fs = require('fs');
const path = require('path');
const os = require('os');

// Set a temporary data directory for testing
const testDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kikoto-test-'));
process.env.DATA_DIR = testDataDir;

const store = require('../store');

describe('store.js Unit Tests', () => {
  const table = 'test_table';

  beforeAll(() => {
    const db = store.load();
    db[table] = [];
    store.save();
  });

  afterAll(() => {
    try {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    } catch (_) {}
  });

  test('insert should add a new row with an ID and timestamps', () => {
    const data = { name: 'Test User', email: 'test@example.com' };
    const result = store.insert(table, data);

    expect(result.id).toBeDefined();
    expect(result.name).toBe(data.name);
    expect(result.created_at).toBeDefined();
    expect(result.updated_at).toBeDefined();

    const all = store.all(table);
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe(data.name);
  });

  test('find should return a single row matching the predicate', () => {
    const row = store.find(table, (r) => r.name === 'Test User');
    expect(row).not.toBeNull();
    expect(row.name).toBe('Test User');
  });

  test('find should return null when no match', () => {
    const row = store.find(table, (r) => r.name === 'Nonexistent');
    expect(row).toBeNull();
  });

  test('all should return all rows matching the predicate', () => {
    store.insert(table, { name: 'Another User' });
    const allUsers = store.all(table);
    expect(allUsers).toHaveLength(2);

    const filtered = store.all(table, (r) => r.name === 'Another User');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe('Another User');
  });

  test('all should return empty array when no match', () => {
    const filtered = store.all(table, (r) => r.name === 'Ghost');
    expect(filtered).toEqual([]);
  });

  test('update should modify matching rows and update updated_at', async () => {
    // Insert fresh row to test timestamp change independently
    const fresh = store.insert(table, { name: 'TimestampTest' });
    const oldUpdatedAt = fresh.updated_at;

    // Small delay to ensure timestamp changes (precision: 1 second)
    await new Promise((r) => setTimeout(r, 1100));

    const n = store.update(table, (r) => r.id === fresh.id, { name: 'TimestampTest Updated' });
    expect(n).toBe(1);

    const updatedRow = store.find(table, (r) => r.id === fresh.id);
    expect(updatedRow.name).toBe('TimestampTest Updated');
    expect(updatedRow.updated_at).not.toBe(oldUpdatedAt);
  });

  test('update should return 0 when no rows match', () => {
    const n = store.update(table, (r) => r.id === 99999, { name: 'Ghost' });
    expect(n).toBe(0);
  });

  test('remove should delete matching rows', () => {
    const initialCount = store.all(table).length;
    const n = store.remove(table, (r) => r.name === 'Another User');
    expect(n).toBe(1);

    const finalCount = store.all(table).length;
    expect(finalCount).toBe(initialCount - 1);
    expect(store.find(table, (r) => r.name === 'Another User')).toBeNull();
  });

  test('remove should return 0 when no rows match', () => {
    const n = store.remove(table, (r) => r.id === 99999);
    expect(n).toBe(0);
  });

  test('now and today should return correctly formatted strings', () => {
    const n = store.now();
    const t = store.today();

    expect(n).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    expect(t).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('IDs should auto-increment per table', () => {
    const row1 = store.insert(table, { name: 'Seq1' });
    const row2 = store.insert(table, { name: 'Seq2' });
    expect(row2.id).toBe(row1.id + 1);
  });

  test('persistence survives reload', () => {
    const name = 'PersistMe ' + Date.now();
    store.insert(table, { name });
    // Force reload from disk
    store.load();
    const found = store.find(table, (r) => r.name === name);
    expect(found).not.toBeNull();
    expect(found.name).toBe(name);
  });

  test('seed data creates demo tables', () => {
    const db = store.load();
    expect(db.users).toBeDefined();
    expect(db.administrators).toBeDefined();
    expect(db.members).toBeDefined();
    expect(db.vehicles).toBeDefined();
    expect(db.frequent_passengers).toBeDefined();
    expect(db.trips).toBeDefined();
    expect(db.bookings).toBeDefined();
    expect(db.invoices).toBeDefined();
    expect(db.admin_actions).toBeDefined();
  });

  test('seed data has correct demo users', () => {
    const user = store.find('users', (u) => u.email === 'admin@kikoto.com');
    expect(user).not.toBeNull();
    expect(user.role).toBe('super_admin');
  });
});
