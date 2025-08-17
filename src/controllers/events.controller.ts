import {inject} from '@loopback/core';
import {
  get,
  param,
  post,
  Request,
  requestBody,
  response,
  RestBindings,
} from '@loopback/rest';
import {addAttendeeToEvent, fetchWebinarEvents} from '../utils/google';
import {
  createAndAttachUserToCompany,
  updateIntercomUserWithContactId,
} from '../utils/intercom';

export class GoogleCalendarController {
  constructor(@inject(RestBindings.Http.REQUEST) private req: Request) {}

  @get('/webinar-events')
  @response(200)
  async getWebinarEvents() {
    const events = await fetchWebinarEvents();
    return events;
  }

  @post('/webinar-events/{eventId}/attendees')
  @response(200)
  async addAttendeeToAnEvent(
    @requestBody({
      content: {
        'application/json': {
          schema: {},
        },
      },
    })
    data: {
      firstName: string;
      lastName: string;
      email: string;
      company?: string;
      jobTitle?: string;
      experienceLevel?: string;
      addToNewsletter?: boolean;
    },
    @param.path.string('eventId') eventId: string,
  ) {
    const {email} = data;
    const user = await createAndAttachUserToCompany(
      {
        email,
        name: data.firstName + ' ' + data.lastName,
        role: 'lead',
        custom_attributes: {
          jobTitle: data.jobTitle,
          experienceLevel: data.experienceLevel,
        },
      },
      data.company ?? '',
    );
    if (user.error) {
      return user;
    }
    if (data.addToNewsletter) {
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
    }

    try {
      await addAttendeeToEvent(eventId, email);
      return {
        message:
          'An invitation has been sent to your email. Kindly check your inbox.',
      };
    } catch (error) {
      console.error('Error adding attendee:', error);
      return {error: 'Failed to add attendee.'};
    }
  }
}
