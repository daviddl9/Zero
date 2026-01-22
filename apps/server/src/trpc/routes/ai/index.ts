import { compose, generateEmailSubject } from './compose';
import { generateSearchQuery } from './search';
import { webSearch } from './webSearch';
import { agentRouter as agent } from './agent';
import { router } from '../../trpc';

export const aiRouter = router({
  generateSearchQuery,
  compose,
  generateEmailSubject,
  webSearch,
  agent,
});
