
const SLACK_TOKEN = process.env.SLACK_TOKEN ?? "";
const SLACK_CHANNEL = process.env.SLACK_CHANNEL ?? "#worldcup";
const SLACK_BOT_NAME = process.env.SLACK_BOT_NAME ?? "WorldCup Bot";
const SLACK_BOT_AVATAR = process.env.SLACK_BOT_AVATAR ?? "";

const SLACK_URL = "https://slack.com/api/chat.postMessage"

/*
 * Post text and attachments to Slack
 */
export async function postToSlack(
  text: string,
  attachmentsText = ""
): Promise<void> {
  const body: Record<string, unknown> = {
    channel: SLACK_CHANNEL,
    username: SLACK_BOT_NAME,
    icon_url: SLACK_BOT_AVATAR,
    unfurl_links: true,
    text,
  };

  if (attachmentsText) {
    body.attachments = [{ text: attachmentsText }];
  }

  const response = await fetch(SLACK_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${SLACK_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const result = await response.json() as { ok: boolean; error?: string };
  if (!result.ok) {
    console.error("Slack API error:", result.error);
  }
}