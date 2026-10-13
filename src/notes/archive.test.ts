import { describe, it, expect, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
import { ARCHIVE_TABLES, createZip, readZip, validateArchive, type Archive } from './archive';
const fixture = (): Archive => ({ version: 1, exported_at: '2026-10-13', tables: Object.fromEntries(ARCHIVE_TABLES.map(t => [t, []])) as Archive['tables'] });
describe('Portable archive', () => {
  it('restores every note field and text unchanged', () => {
    const a = fixture(); a.tables.notes.push({ id: '00000000-0000-0000-0000-000000000001', title: 'Un’idea', content: '<p>Originale\nà</p>', is_private: true, type: 'idea', pos_x: 1, pos_y: 2, pos_z: 3 });
    expect(readZip(createZip(a))).toEqual(a);
  });
  it('rejects incomplete archives and dangling links', () => {
    expect(() => validateArchive({version: 1, tables: {}})).toThrow();
    const a = fixture(); a.tables.edges.push({ id: '00000000-0000-0000-0000-000000000002', a: 'missing', b: 'missing' }); expect(() => validateArchive(a)).toThrow('mancante');
  });
});
