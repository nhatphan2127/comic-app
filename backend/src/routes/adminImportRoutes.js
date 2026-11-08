import express from 'express';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { ALLOWED_IMAGE_TYPES } from '../middlewares/uploadMiddleware.js';
import { UnsupportedMediaTypeError } from '../errors.js';
import { authenticateToken, requireRole } from '../middlewares/authMiddleware.js';
import * as adminImportService from '../services/adminImportService.js';
import { MAX_IMAGE_BYTES } from '../services/adminImportValidation.js';
import * as adminImport from '../controllers/adminImportController.js';

const router = express.Router();
router.use(authenticateToken, requireRole('admin'));

function loadImport(req, res, next) {
  adminImportService.getImportContext(req.user, req.params.importId)
    .then((context) => {
      req.adminImport = context;
      next();
    })
    .catch(next);
}

const upload = multer({
  storage: multer.diskStorage({
    destination(req, file, callback) {
      callback(null, path.join(req.adminImport.directory, 'files'));
    },
    filename(req, file, callback) {
      callback(null, randomUUID());
    },
  }),
  fileFilter(req, file, callback) {
    if (!ALLOWED_IMAGE_TYPES[file.mimetype]) {
      return callback(new UnsupportedMediaTypeError('Only JPEG, PNG, WEBP or GIF images are allowed'));
    }
    callback(null, true);
  },
  limits: {
    fileSize: MAX_IMAGE_BYTES,
    files: 1,
  },
});

router.post('/', adminImport.begin);
router.get('/:importId', adminImport.status);
router.delete('/:importId', adminImport.abort);
router.post('/:importId/files/:fileId', loadImport, upload.single('file'), adminImport.stageItem);
router.post('/:importId/commit', adminImport.commit);

export default router;
