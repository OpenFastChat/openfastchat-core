// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

export const NODE_DESCRIPTIONS: Record<string, string> = {
  user_prompt:
    "Your typed message — every flow starts here.",
  msg_history:
    "Recent messages from this thread, fed in as " +
    "conversation context.",
  system_prompt:
    "A fixed instruction sent to the model as the " +
    "system role.",
  web_search:
    "Runs a Brave web search using the joined input as " +
    "the query.",
  llm:
    "Calls a Groq-hosted model. The connected blocks " +
    "decide what it sees.",
  question:
    "Asks a question about its input and routes down the " +
    "matching answer. Edit the answers, add or remove them.",
  subflow:
    "Embeds another saved flow inline — pick which one " +
    "from the dropdown.",
  files:
    "Outputs all of your uploaded documents as one " +
    "user-role message.",
  compact:
    "Summarises each incoming message above a word " +
    "threshold to a target percentage. Preserves roles.",
  user_output:
    "What you see in chat. Anything wired here becomes " +
    "the reply.",
};
