import axios from 'axios';
import {ObjectId} from 'bson';
import {winstonLogger as logger} from '../config/logger/winston-logger';
import {IntercomUser} from '../types';

const baseUrl = 'https://api.intercom.io';
const headers = {
  'Intercom-Version': '2.11',
  Authorization: `Bearer ${process.env.INTERCOM_ACCESS_TOKEN}`,
};

export const getIntercomUser = async (userId: string) => {
  try {
    const response = await axios.get(
      `${baseUrl}/contacts/find_by_external_id/${userId}`,
      {
        headers: {
          'Intercom-Version': 'Unstable',
          Authorization: `Bearer ${process.env.INTERCOM_ACCESS_TOKEN}`,
        },
      },
    );
    return response.data;
  } catch (err) {
    logger.error(
      `fn <getIntercomUser()>: ${err?.message} - ${JSON.stringify(
        err?.response?.data,
      )}`,
    );
    return {error: err?.message};
  }
};

export const deleteIntercomUser = async (userId: string) => {
  const userData = await getIntercomUser(userId);
  if (userData.error) {
    return userData;
  }
  try {
    const response = await axios.delete(`${baseUrl}/contacts/${userData.id}`, {
      headers,
    });
    return response.data;
  } catch (err) {
    logger.error(
      `fn <deleteIntercomUser()>: ${err?.message} - ${JSON.stringify(
        err?.response?.data,
      )}`,
    );
    return {error: err?.message};
  }
};

export const searchIntercomUser = async (email: string) => {
  try {
    const response = await axios.post(
      `${baseUrl}/contacts/search`,
      {
        query: {
          field: 'email',
          operator: '=',
          value: email,
        },
      },
      {
        headers,
      },
    );
    return response.data;
  } catch (err) {
    logger.error(
      `fn <searchIntercomUser()>: ${err?.message} - ${JSON.stringify(
        err?.response?.data,
      )}`,
    );
    return {error: err?.message};
  }
};

export const createIntercomUser = async (userData: IntercomUser) => {
  try {
    const response = await axios.post(`${baseUrl}/contacts`, userData, {
      headers,
    });
    return response.data;
  } catch (err) {
    logger.error(
      `fn <createIntercomUser()>: ${err?.message} - ${JSON.stringify(
        err?.response?.data,
      )}`,
    );
    return {error: err?.message};
  }
};

export const createCompany = async (companyName: string) => {
  try {
    const response = await axios.post(
      `${baseUrl}/companies`,
      {
        name: companyName,
        company_id: new ObjectId().toHexString(),
      },
      {
        headers,
      },
    );
    return response.data;
  } catch (err) {
    logger.error(
      `fn <createCompany()>: ${err?.message} - ${JSON.stringify(
        err?.response?.data,
      )}`,
    );
    return {error: err?.message};
  }
};

export const getCompany = async (companyName: string) => {
  try {
    const response = await axios.get(
      `${baseUrl}/companies?name=${companyName}`,
      {
        headers,
      },
    );
    return response.data;
  } catch (err) {
    logger.error(
      `fn <getCompany()>: ${err?.message} - ${JSON.stringify(
        err?.response?.data,
      )}`,
    );
    return {error: err?.message};
  }
};

export const attachUserToCompany = async (
  userId: string,
  companyId: string,
) => {
  try {
    const response = await axios.post(
      `${baseUrl}/contacts/${userId}/companies`,
      {
        id: companyId,
      },
      {
        headers,
      },
    );
    return response.data;
  } catch (err) {
    logger.error(
      `fn <attachUserToCompany()>: ${err?.message} - ${JSON.stringify(
        err?.response?.data,
      )}`,
    );
    return {error: err?.message};
  }
};

export const sendContactForm = async (
  userData: IntercomUser,
  message: string,
  company: string = '',
) => {
  const userSearch = await searchIntercomUser(userData.email);
  if (userSearch.error) {
    return userSearch;
  }
  let user;
  if (userSearch.data.length !== 0) {
    user = userSearch.data[0];
  } else {
    const createUser = await createIntercomUser({
      ...userData,
      role: 'lead',
    });
    if (createUser.error) {
      return createUser;
    }
    user = createUser;
  }

  if (company) {
    let companyData;

    companyData = await getCompany(company);
    // TODO: Handle not found error properly
    if (companyData.error) {
      companyData = await createCompany(company);
      if (companyData.error) {
        return companyData;
      }
    }
    const userToCompany = await attachUserToCompany(user.id, companyData.id);
    if (userToCompany.error) {
      return userToCompany;
    }
  }

  try {
    logger.info(
      `fn <sendContactForm()>: Sending message to user ${JSON.stringify(
        user,
      )} - ${message}`,
    );
    const response = await axios.post(
      `${baseUrl}/conversations`,
      {
        from: {
          type: user.role,
          id: user.id,
        },
        body: message,
      },
      {
        headers,
      },
    );
    return response.data;
  } catch (err) {
    logger.error(
      `fn <sendContactForm()>: ${err?.message} - ${JSON.stringify(
        err?.response?.data,
      )}`,
    );

    return {error: err?.message};
  }
};

export const updateIntercomUserWithContactId = async (
  userData: any,
  contactId: string,
) => {
  try {
    const response = await axios.put(
      `${baseUrl}/contacts/${contactId}`,
      userData,
      {
        headers,
      },
    );
    return response.data;
  } catch (err: any) {
    console.error(
      `fn <updateIntercomUser()>: ${err?.message} - ${JSON.stringify(
        err?.response?.data,
      )}`,
    );
    return {error: err?.message};
  }
};

export const addUserToNewsletter = async (email: string) => {
  const userSearch = await searchIntercomUser(email);
  if (userSearch.error) {
    return userSearch;
  }
  let user;
  if (userSearch.data.length !== 0) {
    user = userSearch.data[0];
  } else {
    const createUser = await createIntercomUser({
      email,
      role: 'lead',
    });
    if (createUser.error) {
      return createUser;
    }
    user = createUser;
  }
  const updateUser = await updateIntercomUserWithContactId(
    {
      custom_attributes: {
        subscribed_to_newsletter: true,
      },
    },
    user.id,
  );
  if (updateUser.error) {
    return updateUser;
  }
  return {message: 'Thank you for subscribing!'};
};
