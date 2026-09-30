import { SetMetadata } from '@nestjs/common';
import type { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';

/** Restricts a route (or a whole controller) to the given roles, e.g. @Roles('ADMIN'). */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
