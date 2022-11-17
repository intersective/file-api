import { Log } from '../utils';

const Pool = require('pg').Pool;
// main database
const dbMain = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: 5432,
  max: 1,
  idleTimeoutMillis: 1000,
});
// database of the log (don't need the log database anymore)
// const dbLog = new Pool({
//   user: process.env.DB_LOG_USER,
//   host: process.env.DB_LOG_HOST,
//   database: process.env.DB_LOG_DATABASE,
//   password: process.env.DB_LOG_PASSWORD,
//   port: 5432,
// });

/**
 * Run a SQL query against the database
 * @param  sql            The SQL query string
 * @param  params           The parameters used in the SQL query
 * @param  returnTheFirst   Whether to return the first result or return an array
 * @return                  The Promise that has the finial result
 */
export const query = (sql: string, params: any[] = [], returnTheFirst = false, db = dbMain) =>
  db.query(sql, params)
    .then((res: any) => {
      Log.debug('SQL query result', { sql, params, res: res.rows });
      if (res.rows.length === 0) {
        return returnTheFirst ? null : [];
      }
      return returnTheFirst ? res.rows[0] : res.rows;
    })
    .catch((err: any) => {
      Log.error('SQL query error', { sql, params, err });
      throw err;
    });

export const getEnrolmentCountQuery = (experienceId: number) => {
  const sql = `
  SELECT license.role, c_user.state, count(enrolment)
  FROM core_enrolments AS enrolment
  JOIN core_licenses AS license
    ON enrolment.license_id = license.id
  JOIN core_programs AS program
    ON enrolment.program_id= program.id
  JOIN core_users AS c_user
    ON c_user.id = enrolment.user_id
  WHERE program.experience_id = $1
  GROUP BY license.role, c_user.state
  `;
  return query(sql, [+experienceId]);
}

export const getActiveUserCountQuery = (experienceId: number) => {
  const sql = `
    SELECT license.role, count(enrolment)
    FROM core_enrolments AS enrolment
    JOIN core_licenses AS license
      ON enrolment.license_id = license.id
    JOIN core_programs AS program
      ON enrolment.program_id= program.id
    JOIN core_users AS c_user
      ON c_user.id = enrolment.user_id
    WHERE program.experience_id = $1
      AND extract(day FROM current_timestamp-c_user.lastlog) <=7
    GROUP BY license.role
  `;
  return query(sql, [+experienceId]);
}

export const getFeedbackLoopStartedCountQuery = (experienceId: number) => {
  const sql = `
  SELECT count(tm), submission.id
  FROM assess_assessment_submissions AS submission
  JOIN assess_assessments AS assessment
    ON submission.assessment_id = assessment.id
  LEFT JOIN core_team_members as tm
    ON assessment.is_team = true
    AND submission.team_id = tm.team_id
  JOIN core_programs AS program
    ON submission.program_id= program.id
  JOIN core_users AS c_user
    ON submission.submitter_id = c_user.id
  WHERE program.experience_id = $1
    AND assessment.assessment_type = 'moderated'
  GROUP BY submission.id
  `;
  return query(sql, [+experienceId]).then((res: { count: string; id: string; }[]) => {
    let count = 0;
    res.forEach((c: { count: string; id: string; }) => {
      if (+c.count > 0) {
        count += +c.count
      } else {
        count += 1;
      }
    });
    return count;
  });
}

export const getFeedbackLoopCompletedCountQuery = (experienceId: number) => {
  const sql = `
  SELECT count(todo_item)
  FROM core_todo_items AS todo_item
  JOIN project_projects AS project
    ON todo_item.project_id = project.id
  JOIN core_users AS c_user
    ON todo_item.user_id = c_user.id
  WHERE project.experience_id = $1
    AND todo_item.identifier like 'AssessmentSubmission-%'
    AND todo_item.is_done = true
  `;
  return query(sql, [+experienceId], true).then((res: { count: string; }) => +res.count);
}

export const getReviewRatingAvgQuery = (experienceId: number) => {
  const sql = `
  SELECT avg(rating.rating)
  FROM assess_assessment_review_ratings AS rating
  JOIN assess_assessments AS assessment
    ON rating.assessment_id = assessment.id
  JOIN core_users AS c_user
    ON rating.rater_id = c_user.id
  WHERE assessment.experience_id = $1
  `;
  return query(sql, [+experienceId], true).then((res: { avg: string; }) => +(+res.avg).toFixed(2));
}

export const getTeamStatQuery = (experienceId: number) => {
  const sql = `
  SELECT stat.*
  FROM analytics_team_stats AS stat
  JOIN project_timelines AS timeline
    ON stat.timeline_id = timeline.id
  JOIN core_programs AS program
    ON timeline.program_id= program.id
  JOIN core_users AS c_user
    ON stat.user_id = c_user.id
  WHERE program.experience_id = $1
    AND stat.stat_id = 9
    AND stat.role = 'participant'
  `;
  return query(sql, [+experienceId]);
}

export const getAllExperiencesQuery = () => {
  const sql = `
  SELECT *
  FROM core_experiences
  WHERE deleted = false
  `;
  return query(sql);
}

export const getLearnersStatsQuery = (experienceId: number) => {

  const sql = `
  SELECT  CAST(count(enrol.learner) AS INT) learners, CAST(COALESCE(sum(enrol.pending_enrolments), 0) AS INT) enrolments_pending
  FROM (
  SELECT CONCAT(ce.user_id,',',ce.program_id,',',cl.role) learner,
  CASE WHEN cu.state ='active' then 0
  else 1
  end as pending_enrolments
  FROM core_enrolments ce 
  left outer join core_licenses cl ON ce.license_id = cl.id  
  left join core_programs cp on ce.program_id= cp.id
  left join core_experiences cee on cp.experience_id= cee.id
  left join public.core_users cu on cu.id=ce.user_id
  left join 
  (Select ctm.team_id, ctm.user_id, ct.program_id, ct.name 
  FROM core_team_members ctm 
  join core_teams ct on ctm.team_id= ct.id) tm ON tm.user_id=ce.user_id and ce.program_id=tm.program_id
  WHERE 1=1
  and cee.id=$1
  AND cl.role='participant' 
  AND ce.user_id is not NULL
  AND cl.start is not NULL
  ) enrol
  `;

  return query(sql, [+experienceId], true);
}

export const getProgressStatsQuery = (experienceId: number) => {

  const sql = `Select 
  CAST(COALESCE(to_char(sum(case when final.if_completed= 'Completed' then 1 else 0 end)/count(final.if_completed)::decimal*100,'fm99D00'), '0') AS FLOAT) || '%'
  as completed_ratio,
  sum(case when final.identify_submission_status= 'Completed late' then 1 else 0 end) as late_count
  from(
     SELECT distinct  ce.user_id,cee.id experience_id, aa.id assessment_id,ass_due.latest_submitted_time,
         Case when ass_due.latest_submitted_time is not null then 'Completed'
         when ass_due.latest_submitted_time is null then 'Not completed'
         ELSE 'Not submtted' END as if_completed,
         CASE WHEN (cast(cev.event_end as date)-CAST(now() AS date))>=0 THEN 'Planned'
         WHEN ((cast(cev.event_end as date)-CAST(now() AS date))<0 AND cev.event_end>=ass_due.latest_submitted_time) OR (cev.event_end is null and ass_due.latest_submitted_time is not null) THEN 'Completed On Time'
          WHEN (cast(cev.event_end as date)-CAST(now() AS date))<0 AND cev.event_end<ass_due.latest_submitted_time THEN 'Completed late'
          ELSE 'Late' END as identify_submission_status
          FROM core_enrolments ce 
          left join core_licenses cl ON ce.license_id = cl.id  
          left join core_programs cp on ce.program_id= cp.id
          left join core_experiences cee on cp.experience_id= cee.id
          join public.assess_assessments aa on aa.program_id=ce.program_id and aa.deleted=false
          left join public.core_events cev on cev.program_id=ce.program_id and cev.foreign_key=aa.id And cev.model like '%Assess.Assessment%' and cev.event_type like '%assessment%'    
          left join   
            ( Select distinct ad.assessment_submitted_time,ad.assessment_id,ad.team_submission,ad.fl_user_id,ad.timeline_id,
          ad.program_id,ad.experience_id,ad.latest_submitted_time
          from
          (
                Select distinct aas.submitter_id,aas.assessment_id,aa.is_team team_submission,ctmi.user_id,ctmt.user_id, 
                case when coalesce(ctmi.user_id,ctmt.user_id) is null then aas.submitter_id
                when coalesce(ctmi.user_id,ctmt.user_id) is not null then coalesce(ctmi.user_id,ctmt.user_id)
                else null end as fl_user_id,
                  aas.timeline_id,aas.program_id,cee.id experience_id,aas.submitted assessment_submitted_time,
                  max(aas.submitted) over (partition by aas.assessment_id,aa.name,aa.is_team,
                  coalesce(ctmi.user_id,ctmt.user_id),aas.timeline_id,aas.program_id,cee.id
                  ) as latest_submitted_time

                  FROM public.assess_assessment_submissions aas 
                  JOIN public.assess_assessments AS aa ON aas.assessment_id=aa.id and aa.deleted=false
                  JOIN core_enrolments ce ON ce.user_id=aas.submitter_id
                  left join core_team_members ctmt on ctmt.team_id=aas.team_id AND aa.is_team=TRUE
                  left join core_team_members ctmi on ctmi.user_id=aas.submitter_id AND aa.is_team=FALSE
                  left join core_programs cp on aas.program_id= cp.id
         left join core_experiences cee on cp.experience_id= cee.id 
         ) ad
        where ad.assessment_submitted_time=ad.latest_submitted_time


      ) ass_due on ass_due.fl_user_id=ce.user_id and ass_due.program_id=ce.program_id and ass_due.assessment_id=aa.id 
              WHERE 1=1
              AND (cl.role='participant')
              AND ce.user_id is not NULL
              and cee.id=$1
              order by aa.id
) final`;

  return query(sql, [+experienceId], true);
}

export const getConfidenceAndSatisfactionStatsQuery = (experienceId: number) => {

  const sql = `Select 
  to_char(stat.on_track/(stat.on_track+stat.off_track)::decimal,'fm99D00') confidence, 
  stat.off_track low_confidence_learners, 
  to_char(stat.satisfaction/(stat.satisfaction+stat.not_satisfied)::decimal,'fm99D00') satisfaction, 
  stat.not_satisfied low_satisfaction_learners,stat.week_monday
From(
  Select distinct 
  count(case when num_fb.stat_value='1' and num_fb.stat_id='7' then user_id end) on_track,
  count(case when num_fb.stat_value='0' and num_fb.stat_id='7' then user_id end) off_track,
  count(case when num_fb.stat_value='1' and num_fb.stat_id='8' then user_id end) satisfaction,
  count(case when num_fb.stat_value='0' and num_fb.stat_id='8' then user_id end) not_satisfied,
  num_fb.experience_id,num_fb.Week_monday
  
  From(Select distinct
      ats.stat_value, last.user_id,last.role,last.timeline_id,last.experience_id,last.experience_name,
      last.program_id,last.program_name, ats.stat_id,last.latest_time,date_trunc('week', last.latest_time) Week_monday
      From analytics_team_stats ats
      join (SELECT distinct
          ats.user_id,eit.role,ats.timeline_id,eit.experience_id,eit.experience_name,
          eit.program_id,eit.program_name,ats.stat_id,max(ats.created) latest_time
          --ats.stat_value
          FROM analytics_team_stats ats 
          JOIN (SELECT  ce.user_id,cl.role, ce.timeline_id, 
          ce.program_id, cp.name program_name,  cee.id experience_id, cee.name experience_name,ce.created                          
          FROM core_enrolments ce 
          left outer join core_licenses cl ON ce.license_id = cl.id  
          left join core_programs cp on ce.program_id= cp.id
          left join core_experiences cee on cp.experience_id= cee.id
          ) eit 
          ON ats.user_id=eit.user_id and eit.timeline_id=ats.timeline_id
          where eit.role='participant'
          group by ats.user_id,eit.role,ats.stat_id,ats.timeline_id,
          eit.experience_id,eit.experience_name,eit.program_id,eit.program_name
          )last on last.user_id=ats.user_id 
          AND last.timeline_id=ats.timeline_id
          AND last.latest_time=ats.created
          AND last.stat_id=ats.stat_id
          AND last.role=ats.role
          where last.experience_id=$1
  ) num_fb
  group by num_fb.experience_id,num_fb.Week_monday
  ) stat`;

  return query(sql, [+experienceId], true);
}

export const getEngagementStatsQuery = (experienceId: number) => {

  const sql = `SELECT CAST
	( COALESCE ( to_char( ( ative_learners_count.Presence :: DECIMAL / ative_learners_count.learners_num :: DECIMAL ) * 100, 'fm99D00' ), '0' ) AS FLOAT ) AS engagement,
	ative_learners_count.learners_num - ative_learners_count.Presence low_engagement_learners,
	ative_learners_count.week_monday 
FROM
	(
	SELECT COUNT
		( DISTINCT active_num.user_id ) Presence,
		leaners_num_exp.learners_num,
		active_num.experience_id,
		active_num.institution_id,
		active_num.week_monday 
	FROM
		(
		SELECT DISTINCT
			active.user_id,
			cee.ID experience_id,
			ci.ID institution_id,
			active.user_role,
			COUNT ( DISTINCT ( CAST ( active.created AS DATE ) ) ) days_active,
			date_trunc( 'week', active.created :: TIMESTAMP ) week_monday 
		FROM
			(
			SELECT DISTINCT
				* 
			FROM
				(
				SELECT DISTINCT
					cual.user_id,
					cual.created,
					cual.URI,
					( ( cual.request :: json -> 'user' ) :: json -> 'institution_id' ) :: TEXT institution_id,
					( ( cual.request :: json -> 'user' ) :: json -> 'experience_id' ) :: TEXT experience_id,
					( ( cual.request :: json -> 'user' ) :: json -> 'timeline_id' ) :: TEXT timeline_id,
					( ( cual.request :: json -> 'user' ) :: json -> 'role' ) :: TEXT user_role,
					LAG ( created, 1 ) OVER ( PARTITION BY user_id ORDER BY created ) AS last_event 
				FROM
					core_user_action_logs cual 
				WHERE
					( ( cual.request :: json -> 'user' ) :: json -> 'experience_id' ) :: TEXT LIKE '%' || $1 :: integer || '%' 
					AND ( ( cual.request :: json -> 'user' ) :: json -> 'role' ) :: TEXT NOT LIKE'%sysadmin%' 
					AND ( ( cual.request :: json -> 'user' ) :: json -> 'role' ) :: TEXT NOT LIKE'%admin%' 
					AND ( ( cual.request :: json -> 'user' ) :: json -> 'role' ) :: TEXT NOT LIKE'%coordinator%' 
					AND cual.created > NOW( ) - INTERVAL '7 DAY' 
				) LAST 
			) active
			LEFT JOIN core_enrolments ce ON ce.user_id = CAST ( active.user_id AS INT ) 
			AND ce.timeline_id = CAST ( SUBSTRING ( active.timeline_id FROM '[0-9]+' ) AS INT )
			LEFT JOIN core_licenses cl ON ce.license_id = cl.
			ID LEFT JOIN core_experiences cee ON cee.ID = ce.experience_id
			LEFT JOIN core_institutions ci ON ci.ID = cee.institution_id 
		WHERE
			cl.ROLE = 'participant' 
			AND date_trunc( 'week', active.created :: TIMESTAMP ) > date_trunc( 'week', NOW( ) - INTERVAL '7 DAY' ) 
		GROUP BY
			active.user_id,
			active.user_role,
			cee.ID,
			ci.ID,
			date_trunc( 'week', active.created :: TIMESTAMP ) 
		ORDER BY
			active.user_id 
		) active_num
		LEFT JOIN (
		SELECT
			ce.experience_id,
			COUNT ( ce.user_id ) learners_num 
		FROM
			core_enrolments ce
			LEFT JOIN core_licenses cl ON ce.license_id = cl.ID 
		WHERE
			cl.ROLE = 'participant' 
		GROUP BY
			ce.experience_id 
		) leaners_num_exp ON leaners_num_exp.experience_id = active_num.experience_id 
	WHERE
		active_num.experience_id =$1 
	GROUP BY
		active_num.experience_id,
		active_num.institution_id,
		active_num.week_monday,
	leaners_num_exp.learners_num 
	) ative_learners_count`;
  return query(sql, [+experienceId], true);
}

export const getFeedbackStatsQuery = (experienceId: number) => {

  const sql = `Select CAST(count(p2d.assessment_id)-count(case when p2d.aas_id is not null and p2d.submission_status<>'in progress' then p2d.aas_id else null end) AS INT) Assessments,
  CAST(count (distinct case when (p2d.submission_time<p2d.assessment_due_date OR (p2d.submission_time is not null and p2d.assessment_due_date is null)) then p2d.aas_id_user_id else null end ) AS INT) on_time_submissions,
  CAST(count (distinct case when p2d.submission_time>p2d.assessment_due_date then p2d.aas_id_user_id else null end ) AS INT) Late_Assessments_Submission,
  CAST (count(case when (p2d.aas_id is null or p2d.submission_status='in progress') and CAST(now() AS DATE)-CAST(p2d.assessment_due_date AS DATE)>0 then p2d.user_id else null end) AS INT) Late_Assessments,
  CAST(count (distinct case when p2d.submitter_id is not null and p2d.submission_status<>'in progress'  
  then p2d.aas_id_user_id else NULL end)-count(distinct case when p2d.submission_status='published' then p2d.aas_id_user_id else NULL end) AS INT) Feedback_Requested,
  CAST(count (case when p2d.submitter_id is not null and p2d.submission_status<>'in progress' and p2d.reviewer_id is null then p2d.aas_id_user_id else NULL end) AS INT) Unassigned_Review,
  CAST(count (distinct case when p2d.submitter_id is not null and p2d.submission_status<>'in progress' and p2d.reviewer_id is not null and p2d.review_status<>'done' and p2d.submission_status<>'published' then p2d.aas_id_user_id else NULL end) AS INT) Waiting_Review,
  CAST(count (
  case when p2d.submitter_id is not null and p2d.submission_status<>'in progress' and p2d.reviewer_id is not null and CAST(now() AS DATE)-CAST(p2d.submission_time AS DATE)>3 and p2d.submission_status<>'published'
  then p2d.aas_id_user_id else NULL end) AS INT) Overdue_Review,
  CAST(count(distinct case when p2d.submission_status='published' then p2d.aas_id_user_id else NULL end)-count(distinct case when p2d.completed=1 then p2d.aas_id_user_id else NULL end) AS INT) Feedback_Given,
  CAST(count(distinct case when p2d.submission_status='published' then p2d.aas_id_user_id else NULL end)-count(distinct case when p2d.completed=1 then p2d.aas_id_user_id else NULL end) AS INT) Waiting_Acknowledgement,
  CAST(count(distinct case when p2d.submission_status='published' and p2d.reviewer_role in ('mentor','coordinator','admin') then p2d.aas_id_user_id else NULL end) AS INT) Experts_Reviews,
  CAST(COALESCE(avg(p2d.mentor_time_to_review),0) AS FLOAT) Feedback_Mean_Time_hours,
  CAST(count(distinct case when p2d.completed=1 then p2d.aas_id_user_id else NULL end) AS INT) Feedback_Acknowledge,
  COALESCE(avg(p2d.rating),0)::decimal(16,2) Feedback_Quality,
  CAST(COALESCE(avg(p2d.student_time_to_read_feedback), 0) AS FLOAT) Acknowledge_Mean_Time_days
  
  
  from (
      Select distinct ce.user_id, ce.name user_name,cl.role, concat(ce.user_id,'_',aa.id) user_id_assessment_id,
      tm.team_id,tm.name team_name,
      ce.timeline_id, 
      ce.program_id, cp.name program_name,  
      cee.id experience_id, cee.name experience_name,
      ce.created, cl.start,
      aa.id assessment_id,aa.name assessment_name,aa.is_team team_submission,
      aas1.id team_sub_id,aas2.id non_team_sub_id,
      coalesce(aas1.id,aas2.id) aas_id,
      concat(coalesce(aas1.id,aas2.id),'_',ce.user_id) aas_id_user_id,
      coalesce(aas1.submitter_id,aas2.submitter_id) submitter_id,                          
      coalesce(aas1.status,aas2.status) submission_status,
      coalesce(aas1.submitted,aas2.submitted) submission_time,
      aar.reviewer_id,eitr.reviewer_name,eitr.role reviewer_role, aar.status review_status,cti.name cti_name,
      EXTRACT(EPOCH FROM(case when aar.modified> aar.created then aar.modified-aar.created else null end ))/3600 mentor_time_to_review,
      aar.created review_created,
      aar.modified mentor_review_time,
      case when cti.is_done=true then EXTRACT(EPOCH FROM(cti.modified-aar.modified))/86400
      when cti.is_done<>true then null
      else null end as student_time_to_read_feedback,
      cti.created student_reading_time,
      cti.is_done if_student_read_feedback,
      (case when cti.is_done then 1 else 0 end ) completed,
      (case when aarr.rater_id is null then 0 else 1 end ) students_who_rate,
      max(aarr.created) review_rating_created,aarr.rating,
      cev.event_end assessment_due_date
      FROM assess_assessments aa
      
      join core_enrolments ce on ce.program_id=aa.program_id
      left join (Select ctm.team_id, ctm.user_id, ct.program_id, ct.name 
          FROM core_team_members ctm 
          join core_teams ct on ctm.team_id= ct.id) tm ON tm.user_id=ce.user_id and ce.program_id=tm.program_id
      left outer join core_licenses cl ON ce.license_id = cl.id  
      left join core_programs cp on ce.program_id= cp.id
      left join core_experiences cee on cp.experience_id= cee.id
      left join public.assess_assessment_submissions aas1 on aa.id=aas1.assessment_id and aa.is_team=TRUE and aas1.team_id=tm.team_id
      left join public.assess_assessment_submissions aas2 on aa.id=aas2.assessment_id AND aa.is_team=FALSE and ce.user_id=aas2.submitter_id
      left join assess_assessment_reviews aar ON aar.assessment_submission_id=coalesce(aas1.id,aas2.id)
      left join public.core_events cev on cev.program_id=ce.program_id 
      and cev.foreign_key=aa.id 
      and cev.model like '%Assess.Assessment%' and cev.event_type like '%assessment%'
      left join public.core_todo_items cti 
      on coalesce(aas1.id,aas2.id)=cast(substring(cti.identifier FROM '[0-9]+') as INT) 
      and cti.user_id=ce.user_id and ((lower(cti.name) like '%feedback available%') or cti is null)
      LEFT JOIN public.assess_assessment_review_ratings aarr 
      on CAST(substring(aarr.meta FROM '[0-9]+')AS INT) =CAST(substring(cti.identifier FROM '[0-9]+')AS INT) 
      and cti.user_id=aarr.rater_id
          left JOIN   
          (SELECT  ce.user_id,ce.name reviewer_name,cl.role, 
          tm.team_id,tm.name team_name,
          ce.timeline_id, 
          ce.program_id, cp.name program_name,  
          cee.id experience_id, cee.name experience_name,
          ce.created, cl.start                           
          FROM core_enrolments ce 
          left outer join core_licenses cl ON ce.license_id = cl.id  
          left join core_programs cp on ce.program_id= cp.id
          left join core_experiences cee on cp.experience_id= cee.id
          left join 
          (Select ctm.team_id, ctm.user_id, ct.program_id, ct.name 
          FROM core_team_members ctm 
          join core_teams ct on ctm.team_id= ct.id) tm ON tm.user_id=ce.user_id and ce.program_id=tm.program_id
          WHERE 1=1
          AND ( cl.role='mentor' or cl.role='coordinator' or cl.role='admin' or cl.role='sysadmin')
          AND ce.user_id is not NULL
          AND cl.start is not NULL
          ) eitr ON eitr.user_id=aar.reviewer_id and eitr.program_id=ce.program_id
          
      
          where 
      aa.assessment_type='moderated'
      and aa.deleted=false
      and cl.role='participant'
      and cee.id =$1
    
      group by
      ce.user_id, ce.name, ce.user_id,ce.name,cl.role, 
      tm.team_id,tm.name,
      ce.timeline_id, 
      ce.program_id, cp.name,  
      cee.id, cee.name,
      ce.created, cl.start,
      aa.id,aa.name,aa.is_team,
      aas1.id,aas2.id,
      coalesce(aas1.id,aas2.id),
      coalesce(aas1.submitter_id,aas2.submitter_id),                          
      coalesce(aas1.status,aas2.status),
      coalesce(aas1.submitted,aas2.submitted),
      aar.reviewer_id,eitr.reviewer_name,eitr.role,aar.status,cti.name,
      EXTRACT(EPOCH FROM(aar.modified-aar.created))/86400,
      aar.created,
      aar.modified,
      EXTRACT(EPOCH FROM(cti.modified- cti.created))/86400, 
      
      cti.modified,
      cti.created,
      cti.is_done,
      (case when cti.is_done then 1 else 0 end ),
      (case when aarr.rater_id is null then 0 else 1 end ),
      aarr.rating,cev.event_end
      order by ce.user_id,ce.program_id
  ) p2d`;

  return query(sql, [+experienceId], true);
}

export const getExperienceQuery = (experienceId: number) => {
  const sql = `
  SELECT * FROM core_experiences AS experiences WHERE id = $1`;
  return query(sql, [+experienceId], true);
}

export const getExperienceFeedBackCycleQuery = (experienceId: number) => {
  const sql = `SELECT p2d.milestone_name,p2d.milestone_id,p2d.experience_id,p2d.experience_name,
  CAST(count(p2d.assessment_id)-count(case when p2d.aas_id is not null and p2d.submission_status<>'in progress' then p2d.aas_id else null end) AS INT) assessments_funnel,
   CAST(count (distinct case when p2d.submitter_id is not null and p2d.submission_status<>'in progress'  
  then p2d.aas_id_user_id else NULL end)-count(distinct case when p2d.submission_status='published' then p2d.aas_id_user_id else NULL end) AS INT) feedback_requested_funnel,
 CAST(count(distinct case when p2d.submission_status='published' then p2d.aas_id_user_id else NULL end)-count(distinct case when p2d.completed=1 then p2d.aas_id_user_id else NULL end) AS INT) feedback_given_funnel,
  CAST(count(distinct case when p2d.completed=1 then p2d.aas_id_user_id else NULL end) AS INT) feedback_acknowledge_funnel
  FROM(
   Select distinct ce.user_id, ce.name user_name,cl.role, concat(ce.user_id,'_',aa.id) user_id_assessment_id,
      tm.team_id,tm.name team_name,
      ce.timeline_id, 
      ce.program_id, cp.name program_name,  
      cee.id experience_id, cee.name experience_name,
      ce.created, cl.start,
      aa.id assessment_id,aa.name assessment_name,aa.is_team team_submission,
      aam.milestone_id,pm.name milestone_name,
      aas1.id team_sub_id,aas2.id non_team_sub_id,
      coalesce(aas1.id,aas2.id) aas_id,
      concat(coalesce(aas1.id,aas2.id),'_',ce.user_id) aas_id_user_id,
      coalesce(aas1.submitter_id,aas2.submitter_id) submitter_id,                          
      coalesce(aas1.status,aas2.status) submission_status,
      coalesce(aas1.submitted,aas2.submitted) submission_time,
      aar.reviewer_id,eitr.reviewer_name,eitr.role reviewer_role, aar.status review_status,cti.name cti_name,
      EXTRACT(EPOCH FROM(case when aar.modified> aar.created then aar.modified-aar.created else null end ))/3600 mentor_time_to_review,
      aar.created review_created,
      aar.modified mentor_review_time,
      case when cti.is_done=true then EXTRACT(EPOCH FROM(cti.modified-aar.modified))/86400
      when cti.is_done<>true then null
      else null end as student_time_to_read_feedback,
      cti.created student_reading_time,
      cti.is_done if_student_read_feedback,
      (case when cti.is_done then 1 else 0 end ) completed,
      (case when aarr.rater_id is null then 0 else 1 end ) students_who_rate,
      max(aarr.created) review_rating_created,aarr.rating,
      cev.event_end assessment_due_date
    
   from assess_assessments aa
   join core_enrolments ce on ce.program_id=aa.program_id
   left join (select distinct aa.id assessment_id, min(pm.id) milestone_id
		from assess_assessments aa
		left join project_activity_sequences pas on aa.id= pas.model_id and pas.model='Assess.Assessment'
        left join project_activities pa on pas.activity_id=pa.id
        left join project_milestones pm on pa.milestone_id=pm.id
        where aa.deleted=false
        and aa.assessment_type='moderated'
       	group by aa.id) aam on aam.assessment_id=aa.id
    left join project_milestones pm on pm.id=aam.milestone_id
    
    left join (Select ctm.team_id, ctm.user_id, ct.program_id, ct.name 
          FROM core_team_members ctm 
          join core_teams ct on ctm.team_id= ct.id) tm ON tm.user_id=ce.user_id and ce.program_id=tm.program_id
      left join core_licenses cl ON ce.license_id = cl.id  
      left join core_programs cp on ce.program_id= cp.id
      left join core_experiences cee on cp.experience_id= cee.id
      left join public.assess_assessment_submissions aas1 on aa.id=aas1.assessment_id and aa.is_team=TRUE and aas1.team_id=tm.team_id
      left join public.assess_assessment_submissions aas2 on aa.id=aas2.assessment_id AND aa.is_team=FALSE and ce.user_id=aas2.submitter_id
      left join assess_assessment_reviews aar ON aar.assessment_submission_id=coalesce(aas1.id,aas2.id)
      left join public.core_events cev on cev.program_id=ce.program_id 
      and cev.foreign_key=aa.id 
      and cev.model like '%Assess.Assessment%' and cev.event_type like '%assessment%'
      left join public.core_todo_items cti 
      on coalesce(aas1.id,aas2.id)=cast(substring(cti.identifier FROM '[0-9]+') as INT) 
      and cti.user_id=ce.user_id and ((lower(cti.name) like '%feedback available%') or cti is null)
      LEFT JOIN public.assess_assessment_review_ratings aarr 
      on CAST(substring(aarr.meta FROM '[0-9]+')AS INT) =CAST(substring(cti.identifier FROM '[0-9]+')AS INT) 
      and cti.user_id=aarr.rater_id
          left JOIN   
          (SELECT  ce.user_id,ce.name reviewer_name,cl.role, 
          tm.team_id,tm.name team_name,
          ce.timeline_id, 
          ce.program_id, cp.name program_name,  
          cee.id experience_id, cee.name experience_name,
          ce.created, cl.start                           
          FROM core_enrolments ce 
          left outer join core_licenses cl ON ce.license_id = cl.id  
          left join core_programs cp on ce.program_id= cp.id
          left join core_experiences cee on cp.experience_id= cee.id
          left join 
          (Select ctm.team_id, ctm.user_id, ct.program_id, ct.name 
          FROM core_team_members ctm 
          join core_teams ct on ctm.team_id= ct.id) tm ON tm.user_id=ce.user_id and ce.program_id=tm.program_id
          WHERE 1=1
          AND ( cl.role='mentor' or cl.role='coordinator' or cl.role='admin' or cl.role='sysadmin')
          AND ce.user_id is not NULL
          AND cl.start is not NULL
          ) eitr ON eitr.user_id=aar.reviewer_id and eitr.program_id=ce.program_id
      where 
      aa.assessment_type='moderated'
      and aa.deleted=false
      and cl.role='participant'
      and cee.id =$1
      group by
      ce.user_id, ce.name, ce.user_id,ce.name,cl.role, 
      tm.team_id,tm.name,
      ce.timeline_id, 
      ce.program_id, cp.name,  
      cee.id, cee.name,
      ce.created, cl.start,
      aa.id,aa.name,aa.is_team,aam.milestone_id,pm.name,
      aas1.id,aas2.id,
      coalesce(aas1.id,aas2.id),
      coalesce(aas1.submitter_id,aas2.submitter_id),                          
      coalesce(aas1.status,aas2.status),
      coalesce(aas1.submitted,aas2.submitted),
      aar.reviewer_id,eitr.reviewer_name,eitr.role,aar.status,cti.name,
      EXTRACT(EPOCH FROM(aar.modified-aar.created))/86400,
      aar.created,
      aar.modified,
      EXTRACT(EPOCH FROM(cti.modified- cti.created))/86400, 
      cti.modified,
      cti.created,
      cti.is_done,
      (case when cti.is_done then 1 else 0 end ),
      (case when aarr.rater_id is null then 0 else 1 end ),
      aarr.rating,cev.event_end
      order by ce.user_id,ce.program_id
  ) p2d
   group by p2d.milestone_name,p2d.milestone_id,p2d.experience_id,p2d.experience_name`;
  return query(sql, [+experienceId]);
}

export const getExperienceFeedBackCycleHideLockQuery = (experienceId: number) => {
  const sql = `
  SELECT p2d.milestone_name,p2d.milestone_id,p2d.experience_id,p2d.experience_name,
  CAST(count(p2d.assessment_id)-count(case when p2d.aas_id is not null then p2d.aas_id else null end) AS INT) assessments,
  CAST(sum (case when p2d.unlocked_number >0 and p2d.aas_id is null then 1 else 0 end) AS INT) hide_or_lock,
  CAST(sum (case when p2d.unlocked_number =0 and p2d.aas_id is null then 1 else 0 end) AS INT) visible_not_complete
  FROM(
  
  Select distinct ce.user_id, ce.name user_name,cl.role, 
  tm.team_id,tm.name team_name,
  ce.timeline_id, 
  ce.program_id, cp.name program_name,  
  cee.id experience_id, cee.name experience_name,
  ce.created, cl.start,
  aa.id assessment_id,aa.name assessment_name,
  pas.unlock_id ass_unlock_id,aua1.status ass_unlock_status,pas.reveal_id ass_reveal_id,aua2.status ass_reveal_status, 
  aa.is_team team_submission,pa.name activity_name,
  pa.unlock_id act_unlock_id,aua3.status act_unlock_status,pa.reveal_id act_reveal_id,aua4.status act_reveal_status,
  pm.id milestone_id, pm.name milestone_name,
  pm.unlock_id pm_unlock_id,aua5.status m_unlock_status, pm.reveal_id pm_reveal_id,aua6.status m_reveal_status,
  (case when pas.reveal_id is not null then 1 else 0 end)+(case when pas.unlock_id is not null then 1 else 0 end)+
  (case when pa.reveal_id is not null then 1 else 0 end)+(case when pa.unlock_id is not null then 1 else 0 end)+
  (case when pm.reveal_id is not null then 1 else 0 end)+(case when pm.unlock_id is not null then 1 else 0 end)-
  (case when aua1.status=1 then 1 else 0 end)-(case when aua2.status=1 then 1 else 0 end)-
  (case when aua3.status=1 then 1 else 0 end)-(case when aua4.status=1 then 1 else 0 end)-
  (case when aua5.status=1 then 1 else 0 end)-(case when aua6.status=1 then 1 else 0 end)
  unlocked_number,
  aas1.id team_sub_id,aas2.id non_team_sub_id,
  coalesce(aas1.id,aas2.id) aas_id,
  coalesce(aas1.submitter_id,aas2.submitter_id) submitter_id,                          
  coalesce(aas1.status,aas2.status) submission_status,
  coalesce(aas1.submitted,aas2.submitted) submission_time

  FROM assess_assessments aa
  left join project_activity_sequences pas on aa.id= pas.model_id and pas.model='Assess.Assessment'
  left join project_activities pa on pas.activity_id=pa.id
  left join project_milestones pm on pa.milestone_id=pm.id
  join core_enrolments ce on ce.program_id=aa.program_id
  left join (Select ctm.team_id, ctm.user_id, ct.program_id, ct.name 
      FROM core_team_members ctm 
      join core_teams ct on ctm.team_id= ct.id) tm ON tm.user_id=ce.user_id and ce.program_id=tm.program_id
  left outer join core_licenses cl ON ce.license_id = cl.id  
  left join core_programs cp on ce.program_id= cp.id
  left join core_experiences cee on cp.experience_id= cee.id
  left join public.achieve_user_achievements aua1 on aua1.user_id=ce.user_id and aua1.achievement_id=pas.unlock_id
  left join public.achieve_user_achievements aua2 on aua2.user_id=ce.user_id and aua2.achievement_id=pas.reveal_id
  left join public.achieve_user_achievements aua3 on aua3.user_id=ce.user_id and aua3.achievement_id=pa.unlock_id
  left join public.achieve_user_achievements aua4 on aua4.user_id=ce.user_id and aua4.achievement_id=pa.reveal_id
  left join public.achieve_user_achievements aua5 on aua5.user_id=ce.user_id and aua5.achievement_id=pm.unlock_id
  left join public.achieve_user_achievements aua6 on aua6.user_id=ce.user_id and aua6.achievement_id=pm.reveal_id
  left join public.assess_assessment_submissions aas1 on aa.id=aas1.assessment_id and aa.is_team=TRUE and aas1.team_id=tm.team_id
  left join public.assess_assessment_submissions aas2 on aa.id=aas2.assessment_id AND aa.is_team=FALSE and ce.user_id=aas2.submitter_id
  
      where 
  aa.assessment_type='moderated'
  and cl.role='participant'
  and cee.id =($1)

  group by
  ce.user_id, ce.name, cl.role, 
  tm.team_id,tm.name,
  ce.timeline_id, 
  ce.program_id, cp.name,  
  cee.id, cee.name,
  ce.created, cl.start,
  aa.id,aa.name,aa.is_team,
  pas.unlock_id,aua1.status,
  pas.reveal_id,aua2.status,
  pa.name, 
  pa.unlock_id,aua3.status,
  pa.reveal_id,aua4.status,
  pm.name,pm.id,
  pm.unlock_id,aua5.status,
  pm.reveal_id,aua6.status,
  aas1.id,aas2.id,
  coalesce(aas1.id,aas2.id),
  coalesce(aas1.submitter_id,aas2.submitter_id),                          
  coalesce(aas1.status,aas2.status),
  coalesce(aas1.submitted,aas2.submitted)
  

  order by ce.user_id,ce.program_id
  )p2d
  
  group by p2d.milestone_name,p2d.milestone_id,p2d.experience_id,p2d.experience_name`;
  return query(sql, [+experienceId]);
}

//#region  Upsert Meta field

export const saveMetaByExperienceQuery = (experienceId: number, meta: string) => {
  const sql = `
  UPDATE core_experiences SET meta = $2 WHERE id = $1`;
  return query(sql, [+experienceId, meta]);
}
//#endregion
