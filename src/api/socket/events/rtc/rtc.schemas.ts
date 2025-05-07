import { z } from 'zod';

export const RTCOfferSchema = z
  .object({
    to: z.string(),
    offer: z.any(),
  })
  .strict();

export const RTCAnswerSchema = z
  .object({
    to: z.string(),
    answer: z.any(),
  })
  .strict();

export const RTCCandidateSchema = z
  .object({
    to: z.string(),
    candidate: z.any(),
  })
  .strict();
