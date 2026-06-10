// ─────────────────────────────────────────
// inputValidator.js — Zod schema validation middleware
// Fixes L-07: no amount cap.
// Validates ciphertext, TTL, createdAt, packetId.
// ─────────────────────────────────────────
const { z } = require('zod');

// Zod schema for /bridge/ingest request body
const meshPacketSchema = z.object({
  packetId: z
    .string()
    .uuid({ message: 'packetId must be a valid UUID' }),

  amountPaise: z
    .number()
    .int({ message: 'Amount must be an integer (paise)' })
    .min(1, { message: 'Amount must be at least 1 paise' })
    .max(10000000, { message: 'Amount cannot exceed ₹1,00,000 (10,000,000 paise)' }),

  ttl: z
    .number()
    .int({ message: 'TTL must be an integer' })
    .min(0, { message: 'TTL must be >= 0' })
    .max(10, { message: 'TTL must be <= 10' }),

  createdAt: z
    .number()
    .int({ message: 'createdAt must be an epoch timestamp in milliseconds' })
    .refine(
      (val) => {
        const now = Date.now();
        const oneHourAgo = now - 60 * 60 * 1000;
        const fiveMinFuture = now + 5 * 60 * 1000;
        return val >= oneHourAgo && val <= fiveMinFuture;
      },
      { message: 'createdAt must be a recent timestamp (within last hour, max 5min future)' }
    ),

  ciphertext: z
    .string()
    .min(1, { message: 'Ciphertext must not be empty' })
    .refine(
      (val) => {
        // Basic Base64 format check
        return /^[A-Za-z0-9+/]+=*$/.test(val);
      },
      { message: 'Ciphertext must be a valid Base64 string' }
    ),
});

// Schema for /demo/send request body
const demoSendSchema = z.object({
  senderVpa: z
    .string()
    .min(1, { message: 'Sender VPA is required' }),

  receiverVpa: z
    .string()
    .min(1, { message: 'Receiver VPA is required' }),

  amountPaise: z
    .number()
    .int({ message: 'Amount must be an integer (paise)' })
    .min(1, { message: 'Amount must be at least 1 paise' })
    .max(10000000, { message: 'Amount cannot exceed ₹1,00,000 (10,000,000 paise)' }),

  pin: z
    .string()
    .min(1, { message: 'PIN is required' }),

  ttl: z
    .number()
    .int()
    .min(1)
    .max(10)
    .optional()
    .default(5),
});

/**
 * Middleware: validate /bridge/ingest body with Zod
 */
function validateMeshPacket(req, res, next) {
  const result = meshPacketSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: result.error.issues.map((i) => ({
        field: i.path.join('.'),
        message: i.message,
      })),
    });
  }
  req.body = result.data;
  next();
}

/**
 * Middleware: validate /demo/send body with Zod
 */
function validateDemoSend(req, res, next) {
  const result = demoSendSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: result.error.issues.map((i) => ({
        field: i.path.join('.'),
        message: i.message,
      })),
    });
  }
  req.body = result.data;
  next();
}

module.exports = { validateMeshPacket, validateDemoSend, meshPacketSchema, demoSendSchema };
