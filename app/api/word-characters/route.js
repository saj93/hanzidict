import { cachedCharacters } from '../../../lib/publicWordDetails.js';
import { wordDetailsResponse } from '../../../lib/wordDetailsResponse.js';

export const dynamic = 'force-dynamic';
export const GET = request => wordDetailsResponse(request, 'characters', cachedCharacters);
