import { Router } from 'express';

import { comercialStatus } from '../../lib/comercial/service.js';
import { requireAuth, requireModuleRole } from '../../middleware/auth.js';

const router = Router();
const requireComercialAccess = requireModuleRole('comercial:manager', 'comercial:viewer');

router.use(requireAuth, requireComercialAccess);

router.get('/status', (req, res) => {
  res.json(comercialStatus());
});

export default router;
