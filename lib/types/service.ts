export interface DentalService {
  id: string;
  name: string;
  price: number;
  description?: string;
  imageUrl?: string; // URL for the service image from Cloudinary
  isActive: boolean;
}
