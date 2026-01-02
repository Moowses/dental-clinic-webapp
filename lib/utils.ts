import { z } from "zod";

export type ActionState = {
  success: boolean;
  error?: string;
};

export async function actionWrapper<T>(
  schema: z.ZodSchema<T>,
  serviceFunction: (data: T) => Promise<ActionState>,
  formData: FormData
): Promise<ActionState> {
  const data = Object.fromEntries(formData);
  const parsed = schema.safeParse(data);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0].message,
    };
  }

  return await serviceFunction(parsed.data);
}
