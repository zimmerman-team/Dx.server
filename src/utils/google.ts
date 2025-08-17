import axios from 'axios';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import {URLSearchParams} from 'url';

// Load service account JSON
const serviceAccount = JSON.parse(
  fs.readFileSync(process.env.GOOGLE_CALENDAR_KEY_FILE!, 'utf-8'),
);

const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
];

// Generate OAuth2 access token using JWT
async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccount.client_email,
    scope: SCOPES.join(' '),
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
    sub: process.env.GOOGLE_CALENDAR_SUBJECT, // optional: for domain-wide delegation
  };

  const token = jwt.sign(payload, serviceAccount.private_key, {
    algorithm: 'RS256',
  });

  const res = await axios.post(
    'https://oauth2.googleapis.com/token',
    new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: token,
    }),
    {headers: {'Content-Type': 'application/x-www-form-urlencoded'}},
  );

  return res.data.access_token;
}

// Fetch webinar events
export async function fetchWebinarEvents() {
  const accessToken = await getAccessToken();

  const params: Record<string, string> = {
    timeMin: new Date().toISOString(),
  };
  if (process.env.GOOGLE_CALENDAR_SEARCH_QUERY) {
    params.q = process.env.GOOGLE_CALENDAR_SEARCH_QUERY;
  }

  const res = await axios.get(
    `https://www.googleapis.com/calendar/v3/calendars/${process.env.GOOGLE_CALENDAR_ID}/events`,
    {
      headers: {Authorization: `Bearer ${accessToken}`},
      params,
    },
  );

  return res.data.items ?? [];
}

// Add attendee to event
export async function addAttendeeToEvent(
  eventId: string,
  attendeeEmail: string,
) {
  const accessToken = await getAccessToken();

  // Get event
  const getRes = await axios.get(
    `https://www.googleapis.com/calendar/v3/calendars/${process.env.GOOGLE_CALENDAR_ID}/events/${eventId}`,
    {headers: {Authorization: `Bearer ${accessToken}`}},
  );
  const event = getRes.data;

  const attendees = event.attendees ?? [];
  attendees.push({email: attendeeEmail});

  // Update event
  await axios.put(
    `https://www.googleapis.com/calendar/v3/calendars/${process.env.GOOGLE_CALENDAR_ID}/events/${eventId}`,
    {
      ...event,
      attendees,
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    },
  );
}
