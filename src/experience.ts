import { Log, success } from './utils';
import {
  readCache, writeCache,
  getEnrolmentCountQuery,
  getActiveUserCountQuery,
  getFeedbackLoopStartedCountQuery,
  getFeedbackLoopCompletedCountQuery,
  getReviewRatingAvgQuery,
  getTeamStatQuery,
  getAllExperiencesQuery,
} from './data-sources';

type Role = 'admin' | 'coordinator' | 'mentor' | 'participant';

const CACHE_KEY_PREFIX = 'experience-stats';

export const experience = async (id: number) => {
  const cacheKey = `${ CACHE_KEY_PREFIX }-${ id }`;
  Log.debug('reading cache for the experience', { cacheKey });
  const cachedValue = await readCache(cacheKey);
  Log.debug('get cached value for the experience', { cachedValue, now: Date.now() });
  // don't re-run the query if it is cached less than 1 minute ago
  if (cachedValue && (Date.now() - cachedValue.created < 1000 * 60)) {
    // need to return the data in the same format
    return success(cachedValue.data);
  }
  Log.debug('getting data from database', { id });
  const [
    { enrolledUserCount, registeredUserCount },
    activeUserCount,
    { feedbackLoopStarted, feedbackLoopCompleted },
    reviewRatingAvg,
    onTrackRatio
  ] = await Promise.all([
    getEnrolmentCount(id),
    getActiveUserCount(id),
    getFeedbackLoopCount(id),
    getReviewRatingAvg(id),
    getOnTrackRatio(id)
  ]);
  const result = {
    enrolledUserCount,
    registeredUserCount,
    activeUserCount,
    feedbackLoopStarted,
    feedbackLoopCompleted,
    reviewRatingAvg,
    onTrackRatio
  };
  Log.debug('Writting to cache', { cacheKey, result });
  writeCache(cacheKey, {
    created: Date.now(),
    data: result,
  });
  return success(result);
}

export const allExperiences = async () => {
  const exps: any[] = await getAllExperiencesQuery();
  let exp: any;
  const promises: Promise<any>[] = [];
  for (exp of exps) {
    // don't auto refresh completed experiences
    if (exp.status === 'completed') {
      continue;
    }
    const cacheKey = `${ CACHE_KEY_PREFIX }-${ exp.id }`;
    Log.debug('reading cache for each experience', { cacheKey });
    const cachedValue = await readCache(cacheKey);
    // don't refresh the data if it is cached less than 1 hour ago
    if (cachedValue && Date.now() - cachedValue.created < 1000 * 60 * 60) {
      continue;
    }
    Log.debug('refreshing data', { id: exp.id });
    promises.push(experience(exp.id));
  }
  await Promise.all(promises);
  Log.debug('get all the results');
}

async function getEnrolmentCount(experienceId: number) {
  Log.debug('getting enrolment count', { experienceId });
  const result = await getEnrolmentCountQuery(experienceId);
  const enrolledUserCount = {
    admin: 0,
    coordinator: 0,
    mentor: 0,
    participant: 0,
  };
  const registeredUserCount = {
    admin: 0,
    coordinator: 0,
    mentor: 0,
    participant: 0,
  };
  result.forEach((res: { role: Role; state: string; count: string; }) => {
    if (Object.prototype.hasOwnProperty.call(enrolledUserCount, res.role)) {
      enrolledUserCount[res.role] += +res.count;
      if (res.state === 'active') {
        registeredUserCount[res.role] += +res.count;
      }
    }
  });
  Log.debug('enrolment count data', { experienceId, enrolledUserCount, registeredUserCount });
  return { enrolledUserCount, registeredUserCount };
}

/**
 * Active user count
 *
 * Active user means a user that did any action within the last 7 days
 *
 */
async function getActiveUserCount(experienceId: number) {
  Log.debug('getting active user count', { experienceId });
  const result = await getActiveUserCountQuery(experienceId);
  const count = {
    admin: 0,
    coordinator: 0,
    mentor: 0,
    participant: 0,
  };
  result.forEach((res: { count: string; role: Role }) => {
    if (Object.prototype.hasOwnProperty.call(count, res.role)) {
      count[res.role] += +res.count;
    }
  });
  Log.debug('active user count data', { experienceId, count });
  return count;
}

/**
 * Feedback Loop
 *
 * Feedback loop started means a submission has been made.
 *   If it is a team submission, each team member count as one feedback loop
 *
 * Feedback loop completed means user has marked the todo item for seeing the feedback as done.
 *
 */
async function getFeedbackLoopCount(experienceId: number) {
  Log.debug('getting feedback loop count', { experienceId });
  const [ feedbackLoopStarted, feedbackLoopCompleted ] = await Promise.all([getFeedbackLoopStartedCountQuery(experienceId),
    getFeedbackLoopCompletedCountQuery(experienceId)
  ]);
  Log.debug('feedback loop count data', { experienceId, feedbackLoopStarted, feedbackLoopCompleted });
  return { feedbackLoopStarted, feedbackLoopCompleted };
}

function getReviewRatingAvg(experienceId: number) {
  Log.debug('getting review rating', { experienceId });
  return getReviewRatingAvgQuery(experienceId);
}

/**
 * On track ratio
 *
 * User is on track means (no. of on track records)/(no. of off track records) >= 0.8
 *
 * On track ratio = (no. of user on track)/(no. of user on track) + (no. of user off track)
 */
async function getOnTrackRatio(experienceId: number) {
  Log.debug('getting on track ratio', { experienceId });
  const teamStats = await getTeamStatQuery(experienceId);
  if (!teamStats.length) {
    return -1;
  }
  interface UserStat {
    id: number;
    on: number;
    off: number;
  }
  const userStats: UserStat[] = [];
  teamStats.forEach((teamStat: { user_id: number; stat_value: string; }) => {
    const userIndex = userStats.findIndex((u: UserStat) => u.id === teamStat.user_id);
    if (userIndex >= 0) {
      if (teamStat.stat_value === '1') {
        userStats[userIndex].on += 1;
      } else {
        userStats[userIndex].off += 1;
      }
    } else {
      userStats.push({
        id: teamStat.user_id,
        on: teamStat.stat_value === '1' ? 1 : 0,
        off: teamStat.stat_value === '0' ? 1 : 0,
      });
    }
  });
  const onTrackUserCount = userStats.filter((u: UserStat) => u.on/(u.on + u.off) >= 0.8).length;
  Log.debug('on track ratio data', { experienceId, onTrackUserCount });
  return +(onTrackUserCount/userStats.length).toFixed(2);
}
