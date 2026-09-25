import { z } from 'zod';

const LOCAL_PHONE_REGEX = /^\d{9}$/;
const OTP_CODE_REGEX = /^\d{6}$/;

export const localPhoneSchema = z
  .string()
  .trim()
  .regex(LOCAL_PHONE_REGEX, 'Telefon raqami 9 ta raqamdan iborat bo‘lishi kerak (masalan, 901234567)');

export const registerSchema = z
  .object({
    phoneLocal: localPhoneSchema,
    password: z.string().min(8, 'Kamida 8 ta belgi').max(128, 'Juda uzun'),
    confirmPassword: z.string().min(1, 'Parolni qayta kiriting'),
    firstName: z.string().trim().min(1, 'Ismni kiriting').max(100),
    lastName: z.string().trim().min(1, 'Familiyani kiriting').max(100),
    email: z.string().trim().email('Email noto‘g‘ri').max(255).optional().or(z.literal('')),
    acceptedTerms: z.literal(true, { errorMap: () => ({ message: 'Davom etish uchun shartlarni qabul qiling' }) }),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Parollar bir xil emas',
  });
export type RegisterFormValues = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  phoneLocal: localPhoneSchema,
  password: z.string().min(1, 'Parolni kiriting').max(128),
});
export type LoginFormValues = z.infer<typeof loginSchema>;

export const otpSchema = z.object({
  code: z.string().regex(OTP_CODE_REGEX, '6 xonali kodni kiriting'),
});
export type OtpFormValues = z.infer<typeof otpSchema>;

export function toFullPhone(phoneLocal: string): string {
  return `+998${phoneLocal}`;
}
