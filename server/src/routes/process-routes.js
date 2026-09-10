import { Router } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { config } from '../config.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { addDocument, archiveProcess, completeProcess, createDispatch, createLoan, createOpinion, createProcess, getProcessDetails, listProcesses, receiveRoute, returnLoan, routeProcess, validateDocument } from '../services/process-service.js';

const storage = multer.diskStorage({
  destination: (request, file, callback) => callback(null, config.uploadDir),
  filename: (request, file, callback) => callback(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`)
});
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (request, file, callback) => callback(null, ['application/pdf', 'image/jpeg', 'image/png'].includes(file.mimetype))
});

const router = Router();
router.use(authenticate);

router.get('/', authorize('process.read'), async (request, response, next) => {
  try { response.json(await listProcesses(request.query)); } catch (error) { next(error); }
});

router.post('/', authorize('process.create'), async (request, response, next) => {
  try {
    const { senderId, subject } = request.body;
    if (!senderId || !subject?.trim()) return response.status(422).json({ message: 'Remetente e assunto são obrigatórios.' });
    const process = await createProcess(request.body, request.user, request.ip);
    response.status(201).json(process);
  } catch (error) { next(error); }
});

router.get('/:id', authorize('process.read'), async (request, response, next) => {
  try { response.json(await getProcessDetails(request.params.id)); } catch (error) { next(error); }
});

router.post('/:id/documents', authorize('document.upload'), upload.single('file'), async (request, response, next) => {
  try {
    if (!request.file) return response.status(422).json({ message: 'Seleccione um ficheiro PDF, JPG ou PNG até 15 MB.' });
    const document = await addDocument(request.params.id, request.file, request.body, request.user, request.ip);
    return response.status(201).json(document);
  } catch (error) {
    if (request.file) fs.unlink(request.file.path, () => {});
    return next(error);
  }
});

router.patch('/documents/:documentId/validation', authorize('document.validate'), async (request, response, next) => {
  try { response.json(await validateDocument(request.params.documentId, request.body.validationState, request.body.rejectionReason, request.user, request.ip)); } catch (error) { next(error); }
});

router.post('/:id/routes', authorize('process.route'), async (request, response, next) => {
  try { response.status(201).json(await routeProcess(request.params.id, request.body, request.user, request.ip)); } catch (error) { next(error); }
});

router.patch('/routes/:routeId/receive', authorize('process.receive'), async (request, response, next) => {
  try { response.json(await receiveRoute(request.params.routeId, request.user, request.ip)); } catch (error) { next(error); }
});

router.post('/:id/opinions', authorize('opinion.create'), async (request, response, next) => {
  try { response.status(201).json(await createOpinion(request.params.id, request.body.content, request.user, request.ip)); } catch (error) { next(error); }
});

router.post('/:id/dispatches', authorize('dispatch.create'), async (request, response, next) => {
  try { response.status(201).json(await createDispatch(request.params.id, request.body, request.user, request.ip)); } catch (error) { next(error); }
});

router.post('/:id/complete', authorize('process.complete'), async (request, response, next) => {
  try { response.json(await completeProcess(request.params.id, request.user, request.ip)); } catch (error) { next(error); }
});

router.post('/:id/archive', authorize('archive.manage'), async (request, response, next) => {
  try { response.json(await archiveProcess(request.params.id, request.body, request.user, request.ip)); } catch (error) { next(error); }
});

router.post('/:id/loans', authorize('archive.manage'), async (request, response, next) => {
  try { response.status(201).json(await createLoan(request.params.id, request.body, request.user, request.ip)); } catch (error) { next(error); }
});

router.patch('/loans/:loanId/return', authorize('archive.manage'), async (request, response, next) => {
  try { response.json(await returnLoan(request.params.loanId, request.user, request.ip)); } catch (error) { next(error); }
});

export default router;
