import { experience, allExperiences } from '../experience';
import { success } from '../utils';
import {
  readCache,
  getEnrolmentCountQuery,
  getActiveUserCountQuery,
  getFeedbackLoopStartedCountQuery,
  getFeedbackLoopCompletedCountQuery,
  getReviewRatingAvgQuery,
  getTeamStatQuery,
  getAllExperiencesQuery,
} from '../data-sources';
jest.mock('../utils');
jest.mock('../data-sources');

beforeEach(() => {
  (readCache as jest.Mock).mockReturnValue(null);
  (getEnrolmentCountQuery as jest.Mock).mockReturnValue([
    {
      role: 'participant',
      state: 'active',
      count: 3
    },
    {
      role: 'participant',
      state: 'unverified',
      count: 5
    },
    {
      role: 'mentor',
      state: 'active',
      count: 2
    },
    {
      role: 'mentor',
      state: 'unverified',
      count: 6
    },
    {
      role: 'coordinator',
      state: 'active',
      count: 4
    },
    {
      role: 'coordinator',
      state: 'unverified',
      count: 7
    },
    {
      role: 'admin',
      state: 'active',
      count: 1
    },
    {
      role: 'admin',
      state: 'unverified',
      count: 3
    }
  ]);
  (getActiveUserCountQuery as jest.Mock).mockReturnValue([
    {
      role: 'participant',
      count: 20
    },
    {
      role: 'mentor',
      count: 5
    },
    {
      role: 'coordinator',
      count: 4
    },
    {
      role: 'admin',
      count: 2
    }
  ]);
  (getFeedbackLoopStartedCountQuery as jest.Mock).mockReturnValue(15);
  (getFeedbackLoopCompletedCountQuery as jest.Mock).mockReturnValue(4);
  (getReviewRatingAvgQuery as jest.Mock).mockReturnValue(0.4);
  (getTeamStatQuery as jest.Mock).mockReturnValue([
    {
      user_id: 1,
      stat_value: '1'
    },
    {
      user_id: 1,
      stat_value: '1'
    },
    {
      user_id: 1,
      stat_value: '1'
    },
    {
      user_id: 1,
      stat_value: '1'
    },
    {
      user_id: 1,
      stat_value: '1'
    },
    {
      user_id: 1,
      stat_value: '0'
    },
    {
      user_id: 2,
      stat_value: '1'
    },
    {
      user_id: 2,
      stat_value: '1'
    },
    {
      user_id: 2,
      stat_value: '0'
    },
    {
      user_id: 3,
      stat_value: '1'
    },
    {
      user_id: 3,
      stat_value: '0'
    },
    {
      user_id: 4,
      stat_value: '0'
    }
  ]);
  (getAllExperiencesQuery as jest.Mock).mockReturnValue([
    {
      id: 1,
      status: 'live'
    },
    {
      id: 2,
      status: 'completed'
    }
  ]);
});

afterEach(async () => {
  const res = await experience(1);
  expect(res).toMatchSnapshot();
  allExperiences();
});

it('1. get cached value', () => {
  (readCache as jest.Mock).mockReturnValueOnce({
    created: Date.now() - 1,
    data: 'cached data'
  });
});

it('2. read data from database', () => {

});

it('3. no team stats', () => {
  (getTeamStatQuery as jest.Mock).mockReturnValueOnce([]);
  (readCache as jest.Mock).mockReturnValue({
    created: Date.now() - 1000 * 61,
    data: 'cached data'
  });
});
