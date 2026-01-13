export type ServiceCategory = "preventative" | "restorative" | "cosmetic" | "surgery" | "orthodontics" | "emergency";

export interface DentalService {
  id: string;
  name: string;
  category: ServiceCategory;
  price: number;
  durationMinutes: number;
  description?: string;
  isActive: boolean;
}
