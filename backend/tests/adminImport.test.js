import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';

const testStorageRoot = `${process.env.TEMP || process.env.TMP || process.cwd()}\\comic-admin-import-test-${process.pid}-${Date.now()}`;
process.env.STORAGE_ROOT = testStorageRoot;
process.env.ADMIN_IMPORT_STAGING_DIR = `${testStorageRoot}\\staging`;

const { api, auth, createComic, createUser, models, PNG, unique } = await import('./helpers.js');
const objectStorage = await import('../src/services/objectStorageService.js');

const manifestFor = (url = unique('restore-')) => ({
  comics: [{
    key: 'c0',
    data: {
      id: 'existing-id-must-be-ignored',
      name: unique('Restored comic '),
      url,
      type: 'manga',
      contentRating: 'safe',
    },
    comicJsonBytes: 32,
    cover: { name: 'cover.png', size: PNG.length },
    chapters: [{
      number: 1,
      title: 'Chapter 1',
      folder: 'Chapter 1',
      pages: [{ name: '1.png', size: PNG.length }],
    }],
  }],
});

async function begin(admin, manifest) {
  return api().post('/admin/imports').set(auth(admin)).send(manifest);
}

async function upload(admin, importId, fileId, name = 'image.png') {
  return api()
    .post(`/admin/imports/${importId}/files/${fileId}`)
    .set(auth(admin))
    .attach('file', PNG, { filename: name, contentType: 'image/png' });
}

describe('admin ZIP restore', () => {
  afterAll(async () => {
    await fs.rm(testStorageRoot, { recursive: true, force: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('is restricted to admins', async () => {
    const contributor = await createUser('contributor');
    const manifest = manifestFor();
    expect((await begin(contributor, manifest)).status).toBe(403);
    expect((await api().post('/admin/imports').send(manifest)).status).toBe(401);
  });

  it('does not create records when staging is incomplete', async () => {
    const admin = await createUser('admin');
    const manifest = manifestFor();
    const response = await begin(admin, manifest);
    expect(response.status).toBe(201);

    await upload(admin, response.body.data.id, 'c0-cover', 'cover.png');
    const storageSpy = vi.spyOn(objectStorage, 'uploadStagedStorageFile');
    const commit = await api().post(`/admin/imports/${response.body.data.id}/commit`).set(auth(admin));
    expect(commit.status).toBe(409);
    expect(storageSpy).not.toHaveBeenCalled();
    expect(await models.Comic.findOne({ where: { url: manifest.comics[0].data.url } })).toBeNull();
    expect(await models.AdminImportBatch.findByPk(response.body.data.id)).toBeNull();

    expect((await api().delete(`/admin/imports/${response.body.data.id}`).set(auth(admin))).status).toBe(204);
  });

  it('commits all records together and ignores comic.json ids', async () => {
    const admin = await createUser('admin');
    const manifest = manifestFor();
    const response = await begin(admin, manifest);
    expect(response.status).toBe(201);
    const importId = response.body.data.id;

    expect((await upload(admin, importId, 'c0-cover', 'cover.png')).status).toBe(200);
    expect((await upload(admin, importId, 'c0-h0-p0', '1.png')).status).toBe(200);
    const committed = await api().post(`/admin/imports/${importId}/commit`).set(auth(admin));
    expect(committed.status).toBe(200);
    expect(committed.body.data.summary).toEqual({ comics: 1, chapters: 1, pages: 1 });
    expect(committed.body.data.comics[0].id).not.toBe(manifest.comics[0].data.id);

    const comic = await models.Comic.findByPk(committed.body.data.comics[0].id, { raw: true });
    const chapter = await models.Chapter.findOne({ where: { comicId: comic.id }, raw: true });
    const images = await models.ChapterImage.findAll({ where: { chapterId: chapter.id }, raw: true });
    expect(comic.url).toBe(manifest.comics[0].data.url);
    expect(images).toHaveLength(1);
    expect(await models.AdminImportBatch.findByPk(importId)).not.toBeNull();
    const retry = await api().post(`/admin/imports/${importId}/commit`).set(auth(admin));
    expect(retry.status).toBe(200);
    expect(retry.body.data).toEqual(committed.body.data);
  });

  it('rejects URL conflicts before creating an import session', async () => {
    const admin = await createUser('admin');
    const existing = await createComic(await createUser('contributor'));
    const response = await begin(admin, manifestFor(existing.url));
    expect(response.status).toBe(409);
    expect(await models.Comic.count({ where: { url: existing.url } })).toBe(1);
  });

  it('rejects invalid image bytes before marking a file as uploaded', async () => {
    const admin = await createUser('admin');
    const manifest = manifestFor();
    const response = await begin(admin, manifest);
    const rejected = await api()
      .post(`/admin/imports/${response.body.data.id}/files/c0-cover`)
      .set(auth(admin))
      .attach('file', Buffer.alloc(PNG.length), { filename: 'cover.png', contentType: 'image/png' });
    expect(rejected.status).toBe(415);
    const status = await api().get(`/admin/imports/${response.body.data.id}`).set(auth(admin));
    expect(status.body.data.uploadedItems).toBe(0);
    expect((await api().delete(`/admin/imports/${response.body.data.id}`).set(auth(admin))).status).toBe(204);
  });

  it.each([
    [true, 'accept'],
    [false, 'pending'],
  ])('autoApprove=%s creates comics and chapters as %s', async (autoApprove, expected) => {
    const admin = await createUser('admin');
    const response = await begin(admin, manifestFor());
    const importId = response.body.data.id;
    await upload(admin, importId, 'c0-cover', 'cover.png');
    await upload(admin, importId, 'c0-h0-p0', '1.png');

    const committed = await api().post(`/admin/imports/${importId}/commit`).set(auth(admin)).send({ autoApprove });
    expect(committed.status).toBe(200);
    const comic = await models.Comic.findByPk(committed.body.data.comics[0].id, { raw: true });
    const chapter = await models.Chapter.findOne({ where: { comicId: comic.id }, raw: true });
    expect(comic.status).toBe(expected);
    expect(chapter.status).toBe(expected);
  });

  it('rejects a non-boolean autoApprove', async () => {
    const admin = await createUser('admin');
    const response = await begin(admin, manifestFor());
    const importId = response.body.data.id;
    const committed = await api().post(`/admin/imports/${importId}/commit`).set(auth(admin)).send({ autoApprove: 'yes' });
    expect(committed.status).toBe(400);
    expect((await api().delete(`/admin/imports/${importId}`).set(auth(admin))).status).toBe(204);
  });

  it('stores an image by its real type when the file extension is wrong', async () => {
    const admin = await createUser('admin');
    const manifest = manifestFor();
    // A JPEG named cover.png, as found in real archives; the browser declares it image/png.
    const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(PNG.length - 4)]);
    const response = await begin(admin, manifest);
    const importId = response.body.data.id;

    const cover = await api()
      .post(`/admin/imports/${importId}/files/c0-cover`)
      .set(auth(admin))
      .attach('file', jpeg, { filename: 'cover.png', contentType: 'image/png' });
    expect(cover.status).toBe(200);
    expect((await upload(admin, importId, 'c0-h0-p0', '1.png')).status).toBe(200);
    const committed = await api().post(`/admin/imports/${importId}/commit`).set(auth(admin));
    expect(committed.status).toBe(200);

    const comic = await models.Comic.findByPk(committed.body.data.comics[0].id, { raw: true });
    expect(comic.coverUrl).toMatch(/\.jpg$/);
  });

  it('rolls back database writes and compensates uploaded objects on transaction failure', async () => {
    const admin = await createUser('admin');
    const manifest = manifestFor();
    const response = await begin(admin, manifest);
    const importId = response.body.data.id;
    await upload(admin, importId, 'c0-cover', 'cover.png');
    await upload(admin, importId, 'c0-h0-p0', '1.png');
    const uploadSpy = vi.spyOn(objectStorage, 'uploadStagedStorageFile').mockResolvedValue('staged-object');
    const removeSpy = vi.spyOn(objectStorage, 'removeStorageObject').mockResolvedValue();
    vi.spyOn(models.AdminImportBatch, 'create').mockRejectedValueOnce(new Error('forced transaction failure'));

    const committed = await api().post(`/admin/imports/${importId}/commit`).set(auth(admin));
    expect(committed.status).toBe(500);
    expect(await models.Comic.findOne({ where: { url: manifest.comics[0].data.url } })).toBeNull();
    expect(await models.AdminImportBatch.findByPk(importId)).toBeNull();
    expect(uploadSpy).toHaveBeenCalledTimes(2);
    expect(removeSpy).toHaveBeenCalledTimes(2);
  });
});
