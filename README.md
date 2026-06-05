# WorldCup Bot for Slack

It uses the unofficial FIFA json API (the one used for their mobile app iOS/Android).
It will post a message :

- when a match starts
- for red/yellow card
- for the half time and end time
- for every penalty
- and of course, for every goal

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

### Google Cloud Commands

```bash
echo -n "xoxb-your-new-token" | gcloud secrets versions add slack-token --data-file=- --project=YOUR_PROJECT_ID

echo -n "#your-channel" | gcloud secrets versions add slack-channel --data-file=- --project=YOUR_PROJECT_ID
```

Pause/resume job

```bash
gcloud scheduler jobs pause worldcup-bot-trigger --location=us-central1 --project=YOUR_PROJECT_ID

gcloud scheduler jobs resume worldcup-bot-trigger --location=us-central1 --project=YOUR_PROJECT_ID
```
