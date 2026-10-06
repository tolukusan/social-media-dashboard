import type { User, Role } from '../generated/prisma/client.js';

export type AuthenticatedUser = Omit<User, 'passwordHash'> & { role: Role };
