import { getActiveConnection, connectionToDriver } from '../lib/server-utils';
import type { HonoContext } from '../ctx';
import { Hono } from 'hono';

export const attachmentsRouter = new Hono<HonoContext>();

/**
 * Proxy endpoint for inline images and attachments.
 *
 * Instead of fetching every inline image during thread load (which blocks
 * for 200ms+ per image × dozens of images), the server returns proxy URLs
 * that the browser fetches lazily on demand.
 */
attachmentsRouter.get('/:messageId/:attachmentId', async (c) => {
  const { sessionUser } = c.var;
  if (!sessionUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const { messageId, attachmentId } = c.req.param();
  const mimeType = c.req.query('mimeType') || 'application/octet-stream';

  try {
    const activeConnection = await getActiveConnection();
    const driver = connectionToDriver(activeConnection);
    const base64Data = await driver.getAttachment(messageId, attachmentId);

    if (!base64Data) {
      return c.json({ error: 'Attachment not found' }, 404);
    }

    const binaryData = Uint8Array.from(atob(base64Data), (ch) => ch.charCodeAt(0));

    return new Response(binaryData, {
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'private, max-age=86400',
        'Content-Length': binaryData.length.toString(),
      },
    });
  } catch (error) {
    console.error('[Attachments] Error fetching attachment:', error);
    return c.json({ error: 'Failed to fetch attachment' }, 500);
  }
});
