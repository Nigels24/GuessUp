import type { Role, UserStatus } from '@prisma/client';

/** Claims stored inside the access token. */
export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
}

/** The user as returned by the API: never includes the password hash. */
export interface PublicUser {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  yearLevel: string | null;
  status: UserStatus;
  /** Profile photo (students); null shows the initials. The Cloudinary public id is never sent. */
  avatarUrl: string | null;
}

export interface AuthResponse {
  accessToken: string;
  user: PublicUser;
}
