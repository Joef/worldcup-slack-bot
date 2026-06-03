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
  - You need a token from Slack:
    - Jump at https://api.slack.com/custom-integrations/legacy-tokens (you have to login)
    - and you will find your token.

### Installation

  - Clone this repo
  - Copy `.env` and fill in your values
  - Set up a cron to run every minute:

  ````
  * * * * * cd /path/to/folder && npx ts-node index.ts >> worldCupNotifier.log
  ````

**License:** MIT
