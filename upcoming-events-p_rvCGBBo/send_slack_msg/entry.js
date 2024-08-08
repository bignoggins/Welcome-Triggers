import { axios } from "@pipedream/platform"
import moment from 'moment-timezone'

export default defineComponent({
  props: {
    slack: {
      type: "app",
      app: "slack",
    }
  },
  async run({steps, $}) {
    // Get the events from the previous step
    const events = steps.next_2_weeks_of_events.$return_value[0];
    
    // Group events by week and day
    const groupedEvents = events.reduce((acc, event) => {
      const eventDate = moment.tz(event.start_time_ny.value, 'America/New_York');
      const weekNum = eventDate.week();
      const dayName = eventDate.format('dddd');
      
      if (!acc[weekNum]) acc[weekNum] = {};
      if (!acc[weekNum][dayName]) acc[weekNum][dayName] = [];
      
      acc[weekNum][dayName].push(event);
      return acc;
    }, {});

    // Format the message
    let message = ":calendar: _*UPCOMING EVENTS*_ :calendar:\n\n";
    const weeks = Object.keys(groupedEvents).sort();
    
    weeks.forEach((week, index) => {
      message += index === 0 ? "*THIS WEEK*\n\n" : "*NEXT WEEK*\n\n";
      
      const days = Object.keys(groupedEvents[week]).sort((a, b) => 
        moment(a, 'dddd').day() - moment(b, 'dddd').day()
      );
      
      days.forEach(day => {
        message += `*${day}*\n`;
        groupedEvents[week][day].sort((a, b) => 
          moment(a.start_time_ny.value).diff(moment(b.start_time_ny.value))
        ).forEach(event => {
          const eventTime = moment.tz(event.start_time_ny.value, 'America/New_York');
          const eventLink = `https://app.experiencewelcome.com/admin/events/${event.event_id}`;
          const orgLink = `https://app.experiencewelcome.com/admin/organizations/${event.organization_id}`;
          
          message += `• ${eventTime.format('h:mm A')} ET - <${eventLink}|${event.event_name}> (<${orgLink}|*${event.organization_name}*>), `;
          message += `  _${event.registrations_count} registrations_\n`;
          
        });
        message += "\n";
      });
    });

    // Send the message to Slack
    const slackMessage = {
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: message
          }
        }
      ]
    };

    return await axios($, {
      method: 'post',
      url: `https://slack.com/api/chat.postMessage`,
      headers: {
        Authorization: `Bearer ${this.slack.$auth.oauth_access_token}`,
        'Content-Type': 'application/json',
      },
      
      data: {
        channel: 'C051GUMRN4D',
        username: 'Welcome Events',
        icon_emoji: ':welcomedance:',
        ...slackMessage,
      },
    })
  },
})