import { verifyAccessToken } from '../utils/token.js';
import { unauthorized } from '../utils/errors.js';
import * as userRepository from '../repositories/user.repository.js';

/**
 * JWT verification middleware (spec §8).
 *
 *   1. read the token from the Authorization header
 *   2. verify the signature and expiry
 *   3. resolve the user
 *   4. expose it as req.user for the handlers
 *   5. reject everything else with 401
 *
 * The user is re-read from the database on each request so a deleted account
 * cannot keep operating with a still-valid token.
 */
export async function authenticate(req, res, next) {
  try {
    const header = req.get('authorization') || '';
    const [scheme, token] = header.split(' ');

    if (!token || scheme.toLowerCase() !== 'bearer') {
      throw unauthorized('Authentication required');
    }

    const payload = verifyAccessToken(token);
    const user = await userRepository.findById(Number(payload.sub));
    if (!user) {
      throw unauthorized('Account no longer exists');
    }

    req.user = { id: Number(user.id), name: user.name, email: user.email };
    return next();
  } catch (error) {
    return next(error);
  }
}
