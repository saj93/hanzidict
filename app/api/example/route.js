export const dynamic = 'force-dynamic';
import { cachedExamples } from '../../../lib/publicWordDetails.js';
import { wordDetailsResponse } from '../../../lib/wordDetailsResponse.js';

export const GET = request => wordDetailsResponse(request, 'examples', cachedExamples);
