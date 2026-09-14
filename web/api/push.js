// Alias para /api/notifications/push
import pushHandler from './notifications/push.js';

export default async function handler(req, res) {
  return pushHandler(req, res);
}
