import { z } from "zod";

export const signupSchema = z
  .object({
    name: z.string().max(100).optional().or(z.literal("")),
    email: z.string().min(1, "E-mail é obrigatório").email("E-mail inválido"),
    password: z
      .string()
      .min(1, "Senha é obrigatória")
      .min(6, "A senha deve ter no mínimo 6 caracteres"),
    confirmPassword: z.string().min(1, "Confirme a senha"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });

export type SignupFormData = z.infer<typeof signupSchema>;
