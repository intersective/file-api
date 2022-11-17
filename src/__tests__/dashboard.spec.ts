import { dashboard, checkValue } from '../dashboard';
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
} from '../data-sources';
jest.mock('../utils');
jest.mock('../data-sources');

beforeEach(() => {
  (getLearnersStatsQuery as jest.Mock).mockReturnValue(
    {
      "learners": 7,
      "enrolments_pending": 2,
    }
  );
  (getProgressStatsQuery as jest.Mock).mockReturnValue(
    {
      "completed_ratio": 3,
      "late_count": 1
    }
  );
  (getEngagementStatsQuery as jest.Mock).mockReturnValue(
    {
      "engagement": 0,
      "low_engagement_learners": 0
    }
  );
  (getConfidenceAndSatisfactionStatsQuery as jest.Mock).mockReturnValue(
    {
      "confidence": 0,
      "low_confidence_learners": 0,
      "satisfaction": 0,
      "low_satisfaction_learners": 0,
    }
  );
  (getFeedbackStatsQuery as jest.Mock).mockReturnValue(
    {
      "assessments": 45, "on_time_submissions": 4, "late_assessments_submission": 0, "late_assessments": 0, "feedback_requested": 4,
      "unassigned_review": 1, "waiting_review": 3, "overdue_review": 3, "feedback_given": 0, "experts_reviews": 0,
      "feedback_mean_time_hours_wrong": 0, "feedback_mean_time_hours": 120.981666666667, "feedback_acknowledge": 0,
      "waiting_acknowledgement": 49, "feedback_quality": 0, "acknowledge_mean_time_days": 0
    }
  );
  (getExperienceQuery as jest.Mock).mockReturnValue(
    {
      "name": "Global Trade Accelerator - Sanjaya Test",
      "institution_id": 52,
      "description": "<p dir=\"ltr\" style=\"line-height: 1.2; margin-top: 0pt; margin-bottom: 0pt;\">One of our most popular experiences with over 5,000 happy learners from more than 10 universities to date.<br><br>This experience is perfect if you run 2-week virtual projects where teams of students work collaboratively to solve a real industry challenge, e.g. for a Startup, SME, Corporate, Non-profit or Government.</p><p dir=\"ltr\" style=\"line-height: 1.2; margin-top: 0pt; margin-bottom: 0pt;\"><br></p><p dir=\"ltr\" style=\"line-height: 1.2; margin-top: 0pt; margin-bottom: 0pt;\">Each student is expected to input 25 hours of effort across the two weeks and will work in a remote, virtual fashion with their team. The Practera app is used to support participants through their experiential learning; participants will submit deliverables (Draft &amp; Final Report) for Client review, iteratively reflect on their skill development and experience, and to access supportive learning content.<br></p><p dir=\"ltr\" style=\"line-height: 1.2; margin-top: 0pt; margin-bottom: 0pt;\"><br></p><p dir=\"ltr\" style=\"line-height: 1.2; margin-top: 0pt; margin-bottom: 0pt;\"><br></p>",
      "slug": "",
      "login_content": "",
      "id": 803,
      "navbar_content": "",
      "deleted": false,
      "deleted_date": null,
      "domain": "",
      "show_login_navbar": false,
      "allow_signup": false,
      "logo_url": "/storage/filestores/open/43117.png",
      "archived": false,
      "appkey": "b11e7c189b",
      "app_uri": "practera.app",
      "terms": "",
      "config": "{\"primary_color\":\"#2bc1d9\",\"secondary_color\":\"#9fc5e8\",\"email_template\":\"email_1\",\"card_url\":\"https:\\/\\/cdn.filestackcontent.com\\/4PCfsRBoQ9uNrXRrYBWb\",\"manual_url\":\"https:\\/\\/www.filepicker.io\\/api\\/file\\/lNQp4sFcTjGj2ojOm1fR\",\"design_url\":\"https:\\/\\/www.filepicker.io\\/api\\/file\\/VuL71nOUSiM9NoNuEIhS\",\"overview_url\":\"https:\\/\\/vimeo.com\\/325554048\",\"banner_url\":\"https:\\/\\/cdn.filestackcontent.com\\/tuhgyojYQmKkW7SpIKu2\"}",
      "custom_email_domain": "[]",
      "app_background_image": "https://cdn.filestackcontent.com/SqlvR3PzQ36KzR5kQHSU",
      "lead_url": "https://cdn.filestackcontent.com/SqlvR3PzQ36KzR5kQHSU",
      "experience_type": "Team Project",
      "uuid": "51f5adb4-8bfe-4199-afd2-e840fdefa34d",
      "status": "live",
      "meta": "{\"logs\":[{\"live_at\":1637733424}],\"stats\":{\"overview_metrics\":{\"learners\":\"7\",\"enrolments_pending\":\"2\",\"progress\":0,\"confidence\":0,\"low_confidence_learners\":0,\"satisfaction\":0,\"low_satisfaction_learners\":0,\"engagement\":0,\"low_enagagement_learners\":0},\"funnel_metrics\":{\"late_assessments\":0,\"feedback_requested\":0,\"unassigned_reviews\":0,\"assessment_waiting_review\":0,\"overdue_reviews\":0,\"feedback_given\":0,\"experts_reviews\":0,\"feedback_mean_time\":0,\"feedback_acknowledgement\":0,\"waiting_acknowledgement\":0,\"feedback_quality\":0,\"acknowledge_mean_time\":0}}}",
      "tags": null,
      "created": "2021-11-24T00:51:26.114Z",
      "modified": "2022-04-25T17:49:02.000Z",
      "support_email": "help@practera.com"
    }
  );
  (saveMetaByExperienceQuery as jest.Mock).mockReturnValue(null);
  (getExperienceFeedBackCycleQuery as jest.Mock).mockReturnValue(
    [
      {
        "milestone_id": 6922,
        "milestone_name": "GETTING STARTED",
        "experience_id": 803,
        "experience_name": "Global Trade Accelerator - Sanjaya Test",
        "assessments_funnel": 24,
        "feedback_given_funnel": 0,
        "feedback_acknowledge_funnel": 0,
        "feedback_requested_funnel":0,
      },
      {
        "milestone_id": 6928,
        "milestone_name": "Hello",
        "experience_id": 803,
        "experience_name": "Global Trade Accelerator - Sanjaya Test",
        "assessments_funnel": 7,
        "feedback_given_funnel": 0,
        "feedback_acknowledge_funnel": 0,
        "feedback_requested_funnel":0,
      },
      {
        "milestone_id": 6925,
        "milestone_name": "WEEK 1 - DRAFT REPORT",
        "experience_id": 803,
        "experience_name": "Global Trade Accelerator - Sanjaya Test",
        "assessments_funnel": 7,
        "feedback_given_funnel": 0,
        "feedback_acknowledge_funnel": 0,
        "feedback_requested_funnel":0,
      },
      {
        "milestone_id": 6926,
        "milestone_name": "WEEK 2 - FINAL REPORT",
        "experience_id": 803,
        "experience_name": "Global Trade Accelerator - Sanjaya Test",
        "assessments_funnel": 7,
        "feedback_given_funnel": 0,
        "feedback_acknowledge_funnel": 0,
        "feedback_requested_funnel":0,
      }
    ]
  );
  (getExperienceFeedBackCycleHideLockQuery as jest.Mock).mockReturnValue(
    [
      {
        "milestone_id": 6922,
        "milestone_name": "GETTING STARTED",
        "experience_id": 803,
        "experience_name": "Global Trade Accelerator - Sanjaya Test",
        "assessments": 24,
        "hide_or_lock": 0,
        "visible_not_complete": 24
      },
      {
        "milestone_id": 6928,
        "milestone_name": "Hello",
        "experience_id": 803,
        "experience_name": "Global Trade Accelerator - Sanjaya Test",
        "assessments": 7,
        "hide_or_lock": 0,
        "visible_not_complete": 7
      },
      {
        "milestone_id": 6925,
        "milestone_name": "WEEK 1 - DRAFT REPORT",
        "experience_id": 803,
        "experience_name": "Global Trade Accelerator - Sanjaya Test",
        "assessments": 7,
        "hide_or_lock": 7,
        "visible_not_complete": 0
      },
      {
        "milestone_id": 6926,
        "milestone_name": "WEEK 2 - FINAL REPORT",
        "experience_id": 803,
        "experience_name": "Global Trade Accelerator - Sanjaya Test",
        "assessments": 7,
        "hide_or_lock": 7,
        "visible_not_complete": 0
      }
    ]
  );
  Date.now = jest.fn().mockReturnValue(1658346701023);
});

afterEach(async () => {
  const res = await dashboard(803);
  expect(res).toMatchSnapshot();
});

it('1. read data from database', () => {

});
