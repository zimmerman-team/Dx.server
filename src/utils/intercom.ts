import axios from 'axios';

export const getIntercomUser = async (userId: string) => {
  const response = await axios.get(
    `https://api.intercom.io/contacts/find_by_external_id/${userId}`,
    {
      headers: {
        'Intercom-Version': 'Unstable',
        Authorization: `Bearer ${process.env.INTERCOM_ACCESS_TOKEN}`,
      },
    },
  );
  return response;
};

export const deleteIntercomUser = async (userId: string) => {
  const userResponse = await getIntercomUser(userId);

  const response = await axios.delete(
    `https://api.intercom.io/contacts/${userResponse.data.id}`,
    {
      headers: {
        'Intercom-Version': '2.11',
        Authorization: `Bearer ${process.env.INTERCOM_ACCESS_TOKEN}`,
      },
    },
  );
  return response;
};
