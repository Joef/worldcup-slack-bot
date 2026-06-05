# WorldCup SlackBot

- when a match starts
- for red/yellow card
- for the half time and end time
- for every penalty
- and of course, for every goal

### Find the competition you are looking for

| World Cup                           | `ID_COMPETITION` | `ID_SEASON` |
| ----------------------------------- | ---------------- | ----------- |
| FIFA World Cup Russia 2018™         | 17               | 254645      |
| FIFA U-20 World Cup Poland 2019     | 104              | 281971      |
| FIFA Women's World Cup France 2019™ | 103              | 278513      |
| FIFA World Cup Qatar 2022™          | 17               | 255711      |
| FIFA World Cup 2026                 | 17               | 285023      |

If the competition you are looking for isn't defined below, here is how you can find these numbers:

- determine when the competition will start (for example `2022-11-19T00:00:00Z`)
- go to `https://api.fifa.com/api/v3/calendar/matches?from=DATE_START&language=en&count=500` and replace `DATE_START` with the previous date (be careful to use the same format)
- look for the competition (for example `FIFA World Cup Qatar 2022`)
- get the correspondant values:
  - `IdSeason`
  - `IdCompetition`

### Requirements

- Node.js >= 18
- Your Slack app needs these two scopes: chat:write and chat:write.customize (the latter is required for the custom username and icon_url fields).

### Installation

- Clone this repo
- Copy `.env` and fill in your values
- Set up a cron to run every minute:

```
* * * * * cd /path/to/folder && npx ts-node index.ts >> worldCupNotifier.log
```

### Google Cloud

Use the setup.sh document to deploy create the infrastructure for a google cloud environment, updating the settings at the top of the file.

Build and deploy

#### Commands

```bash
echo -n "xoxb-your-new-token" | gcloud secrets versions add slack-token --data-file=- --project=YOUR_PROJECT_ID

echo -n "#your-channel" | gcloud secrets versions add slack-channel --data-file=- --project=YOUR_PROJECT_ID
```

Pause/resume job

```bash
gcloud scheduler jobs pause worldcup-bot-trigger --location=us-central1 --project=YOUR_PROJECT_ID

gcloud scheduler jobs resume worldcup-bot-trigger --location=us-central1 --project=YOUR_PROJECT_ID
```

Update schedule to run during the day, UTC (3pm-11pm, 12am-4am). This cuts the usage in half, give or take.

```bash
gcloud scheduler jobs update http worldcup-bot-trigger \
  --schedule="* 15-23,0-4 * * *" \
  --location=us-central1 \
  --project=YOUR_PROJECT_ID
```
