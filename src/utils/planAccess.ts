import _ from 'lodash';
import {UserProfile} from '../authentication-strategies/user-profile';

type Plan = 'free' | 'pro' | 'team' | 'enterprise';

export const planAccessData = {
  free: {
    name: 'Free',
    datasets: {
      noOfDatasets: 5,
      datasetsSize: 1024,
      availability: 180,
      connectData: true,
      exportDatasetCsv: false,
      connectYourOwnDataSource: false,
      googleDrive: false,
    },
    charts: {
      noOfCharts: 10,
      chartBuilderAccess: true,
      shareChart: true,
      basicCharts: true,
      advancedCharts: false,
      aiAgent: false,
      customCharting: false,
    },
    reports: {
      noOfReports: 5,
      basicTemplates: true,
      advancedTemplates: true,
      mediaSupport: false,
      aiChat: false,
      aiAgent: false,
    },
  },
  pro: {
    name: 'Pro',
    datasets: {
      noOfDatasets: 100,
      datasetsSize: 10240,
      availability: true,
      connectData: true,
      exportDatasetCsv: true,
      connectYourOwnDataSource: true,
      googleDrive: true,
    },
    charts: {
      noOfCharts: 100,
      chartBuilderAccess: true,
      shareChart: true,
      basicCharts: true,
      advancedCharts: true,
      aiAgent: true,
      customCharting: true,
    },
    reports: {
      noOfReports: 100,
      basicTemplates: true,
      advancedTemplates: true,
      mediaSupport: true,
      aiChat: true,
      aiAgent: true,
    },
  },
  team: {
    name: 'Team',
    datasets: {
      noOfDatasets: 1000,
      datasetsSize: 25600,
      availability: true,
      connectData: true,
      exportDatasetCsv: true,
      connectYourOwnDataSource: true,
      googleDrive: true,
    },
    charts: {
      noOfCharts: 5000,
      chartBuilderAccess: true,
      shareChart: true,
      basicCharts: true,
      advancedCharts: true,
      aiAgent: true,
      customCharting: true,
    },
    reports: {
      noOfReports: 1000,
      basicTemplates: true,
      advancedTemplates: true,
      mediaSupport: true,
      aiChat: true,
      aiAgent: true,
    },
  },
  enterprise: {
    name: 'Enterprise',
    datasets: {
      noOfDatasets: 10000,
      datasetsSize: 102400,
      availability: true,
      connectData: true,
      exportDatasetCsv: true,
      connectYourOwnDataSource: true,
      googleDrive: true,
    },
    charts: {
      noOfCharts: 50000,
      chartBuilderAccess: true,
      shareChart: true,
      basicCharts: true,
      advancedCharts: true,
      aiAgent: true,
      customCharting: true,
    },
    reports: {
      noOfReports: 10000,
      basicTemplates: true,
      advancedTemplates: true,
      mediaSupport: true,
      aiChat: true,
      aiAgent: true,
    },
  },
  beta: {
    name: 'Beta',
    datasets: {
      noOfDatasets: 99999999999,
      datasetsSize: 99999999999,
      availability: true,
      connectData: true,
      exportDatasetCsv: true,
      connectYourOwnDataSource: true,
      googleDrive: true,
    },
    charts: {
      noOfCharts: 99999999999,
      chartBuilderAccess: true,
      shareChart: true,
      basicCharts: true,
      advancedCharts: true,
      aiAgent: true,
      customCharting: true,
    },
    reports: {
      noOfReports: 99999999999,
      basicTemplates: true,
      advancedTemplates: true,
      mediaSupport: true,
      aiChat: true,
      aiAgent: true,
    },
  },
};

export const getUserPlanData = async (userId: string) => {
  if (process.env.PRICING_ACTIVE !== 'true') {
    return planAccessData.beta;
  }
  const userProfile = await UserProfile.getUserProfile(userId);
  if (!userProfile) {
    return planAccessData.free;
  }
  // Also to an organization check to check if user belongs to a team
  const planName: Plan = _.get(
    userProfile,
    'app_metadata.planName',
    'free',
  ).toLowerCase();

  return _.get(planAccessData, planName);
};
