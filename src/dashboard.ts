import { Log, success } from './utils';
import {
  getLearnersStatsQuery,
  getProgressStatsQuery,
  getEngagementStatsQuery,
  getFeedbackStatsQuery,
  getExperienceQuery,
  saveMetaByExperienceQuery,
  getExperienceFeedBackCycleQuery,
  getExperienceFeedBackCycleHideLockQuery,
  getConfidenceAndSatisfactionStatsQuery,
} from './data-sources';

/*
 id : experience id for which to caluclate stats
*/
export const dashboard = async (id: number) => {
  const result = await getDashboardStats(id);
  return success(result);
}

async function getDashboardStats(experienceId: number) {
  const [
    learnerStats,
    progressStats,
    engagementStats,
    confidenceAndSatisfactionStats,
    feedbackStats,
    experience,
    feedbackCycleStats,
    feedBackCycleHideLockStats
  ] = await Promise.all([
    getLearnersStatsQuery(experienceId),
    getProgressStatsQuery(experienceId),
    getEngagementStatsQuery(experienceId),
    getConfidenceAndSatisfactionStatsQuery(experienceId),
    getFeedbackStatsQuery(experienceId),
    getExperienceQuery(experienceId),
    getExperienceFeedBackCycleQuery(experienceId),
    getExperienceFeedBackCycleHideLockQuery(experienceId)
  ]);
  
  const overviewMetrics = {
    'learners': checkValue(learnerStats, 'learners', 0),
    'enrolmentsPending': checkValue(learnerStats, 'enrolments_pending', 0),
    'progress': checkValue(progressStats, 'completed_ratio', 0),
    'confidence': checkValue(confidenceAndSatisfactionStats, 'confidence', 0),
    'lowConfidenceLearners': checkValue(confidenceAndSatisfactionStats, 'low_confidence_learners', 0),
    'satisfaction': checkValue(confidenceAndSatisfactionStats, 'satisfaction', 0),
    'lowSatisfactionLearners': checkValue(confidenceAndSatisfactionStats, 'low_satisfaction_learners', 0),
    'engagement': checkValue(engagementStats, 'engagement', 0),
    'lowEngagementLearners': checkValue(engagementStats, 'low_engagement_learners', 0),
  }

  const funnelMetrics = {
    'unsubmittedAssessmentCount': checkValue(feedbackStats, 'assessments', 0),
    'assessmentsSubmitted': checkValue(feedbackStats, 'on_time_submissions', 0),
    'lateAssessmentSubmissions': checkValue(feedbackStats, 'late_assessments_submission', 0),
    'lateAssessments': checkValue(feedbackStats, 'late_assessments', 0),
    'feedbackRequested': checkValue(feedbackStats, 'feedback_requested', 0),
    'unassignedReviews': checkValue(feedbackStats, 'unassigned_review', 0),
    'assessmentWaitingReview': checkValue(feedbackStats, 'waiting_review', 0),
    'overdueReviews': checkValue(feedbackStats, 'overdue_review', 0),
    'feedbackGiven': checkValue(feedbackStats, 'feedback_given', 0),
    'expertsReviews': checkValue(feedbackStats, 'experts_reviews', 0),
    'feedbackMeanTime': checkValue(feedbackStats, 'feedback_mean_time_hours', 0),
    'feedbackAcknowledgement': checkValue(feedbackStats, 'feedback_acknowledge', 0),
    'waitingAcknowledgement': checkValue(feedbackStats, 'waiting_acknowledgement', 0),
    'feedbackQuality': checkValue(feedbackStats, 'feedback_quality', 0),
    'acknowledgeMeanTime': checkValue(feedbackStats, 'acknowledge_mean_time_days', 0),
  }
  const feedbackCycleMetrics: any[] = [];
  feedbackCycleStats.forEach((feedBackCycleStat: any, index: number) => {
    feedbackCycleMetrics.push(
      {
        'milestoneId': checkValue(feedBackCycleStat, 'milestone_id', 0),
        'milestoneName': checkValue(feedBackCycleStat, 'milestone_name', 0),
        'experienceId': checkValue(feedBackCycleStat, 'experience_id', 0),
        'experienceName': checkValue(feedBackCycleStat, 'experience_name', 0),
        'unsubmittedAssessmentCount': checkValue(feedBackCycleStat, 'assessments_funnel', 0),
        'feedbackRequested': checkValue(feedBackCycleStat, 'feedback_requested_funnel', 0),
        'feedbackGiven': checkValue(feedBackCycleStat, 'feedback_given_funnel', 0),
        'feedbackAcknowledge': checkValue(feedBackCycleStat, 'feedback_acknowledge_funnel', 0),
        'hideOrLock': checkValue(feedBackCycleHideLockStats[index], 'hide_or_lock', 0),
        'visibleNotComplete': checkValue(feedBackCycleHideLockStats[index], 'visible_not_complete', 0),
      }
    )
  });

  const result = {
    overviewMetrics,
    funnelMetrics,
    feedbackCycleMetrics,
    lastUpdated: Date.now()
  }

  // pull experience table decode meta json field
  let meta = checkValue(experience, 'meta', null);
  meta = meta && meta != '[]'  ? JSON.parse(experience.meta) : {};
  // array push new element to decoded array
  meta.dashboardStatistics = result;

  Log.debug('saving dashboard stats', { experience });
  // update meta column with new encoded json object
  await saveMetaByExperienceQuery(experienceId, JSON.stringify(meta));
  return result;
}

/*
* checks for nulls and return value or 0/null
*/
export const checkValue = (data: any, key: string, defaultValue: any) => {
  return data ? data[key] : defaultValue;
}
