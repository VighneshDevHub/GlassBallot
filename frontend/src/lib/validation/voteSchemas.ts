import { z } from "zod";

export const OtpRequestSchema = z.object({
  voter_id: z.string().min(3).max(20),
});

export const OtpVerifyRequestSchema = z.object({
  voter_id: z.string().min(3).max(20),
  otp: z.string().min(6).max(8),
});

export const AdminLoginSchema = z.object({
  username_or_email: z.string().min(2).max(255),
  password: z.string().min(1).max(512),
});

export const BallotSpoilRequestSchema = z.object({
  ballot: z.object({
    v: z.number().int().min(1).max(1),
    eph: z.string().min(1),
    iv: z.string().min(1),
    ct: z.string().min(1),
  }),
  eph_d: z.string().min(1),
  claimed_choice: z.string().min(1),
});

export const BallotCastRequestSchema = z.object({
  token: z.string().min(1),
  ballot: z.object({
    v: z.number().int().min(1).max(1),
    eph: z.string().min(1),
    iv: z.string().min(1),
    ct: z.string().min(1),
  }),
});

export const VotingTokenRequestSchema = z.object({
  election_id: z.string().optional().nullable(),
});

export const DemoAttackSchema = z.object({
  kind: z.string().min(1),
});

export const DemoSeedSchema = z.object({
  n: z.number().int().min(1).max(100).optional(),
});

export type OtpRequestInput = z.infer<typeof OtpRequestSchema>;
export type OtpVerifyRequestInput = z.infer<typeof OtpVerifyRequestSchema>;
export type AdminLoginInput = z.infer<typeof AdminLoginSchema>;
