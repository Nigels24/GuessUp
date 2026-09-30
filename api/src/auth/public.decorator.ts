import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Exempts a route from the global JwtAuthGuard. Everything else requires a token. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
