# What is OpenFastChat?

A chat app where you can see and change how the AI works.

Most AI chats — ChatGPT, Claude, Gemini — are black boxes. You don't know which
model answered, what got pulled into context, or what tools ran. So:

- Prices can jump overnight and you're stuck
- Behavior shifts silently and breaks what you depended on
- You can't debug or adjust anything when it's wrong

OpenFastChat is different:

- **Open models** — open-weight models, nothing proprietary
- **Fast** — served on Groq, answers stream quicker than most apps
- **Open flows** — every chat runs a small diagram of steps you can edit
- **Fair pricing** — close to actual inference cost, no hidden markup
- **Public marketplace** — browse flows other people built, take one, make it
  yours
- **You stay in control** — your flows are yours to export, fork, and walk away
  with; cancel anytime; no model swap behind your back

# What are flows?

A flow is the recipe your chat runs. Each block is one step:

- a **prompt** block (what you type)
- a **history** block (previous messages)
- a **web search** block (fetches results)
- a **model** block (the AI that writes the answer)
- an **output** block (what you see)

Connect them however you like. Want the model to skip search? Disconnect that
block. Want a different system prompt? Drop one in. Want two models to answer
side-by-side? Wire both up.

Click **Flows** in the header to open the editor and see the flow this very chat
is running. Click **Marketplace** to browse flows other people have built — use
one as-is, or hit **Edit** and it forks into your own editable copy.

Not sure what a block does? **Hover over it** — both the pills in the toolbar
above the canvas and the blocks already on the canvas show a short description
after a brief pause.

# How much does it cost?

You pay for what you use. A few ways in:

- **Just looking** — a handful of free prompts without signing in. Enough to
  see the speed and try a flow.
- **Sign up** — a small credit balance is added to your account so you can
  decide whether this is for you. When it runs out you pick what comes next.
- **Top up** — add any amount in one go (with a small minimum).
  Your balance ticks down per prompt by the actual variable cost of the call
  (model inference plus a small markup that keeps the lights on). Unused
  balance stays put — it doesn't expire.
- **Subscribe** — a flat monthly fee for a generous compute cap. Most people
  don't use it all; that's what makes the flat price work for both sides.
  Heavy users can still top up on top of the subscription if they cap out.

Current numbers live on the top-up screen and update if we adjust them.

Why not "unlimited"? Inference isn't free, and "unlimited" plans only stay
unlimited until the provider quietly throttles you. Per-prompt billing at
near-cost is honest: you see what each chat actually costs, and we're not
incentivized to degrade model quality to claw back margin.

# How does the actual chat work?

When you hit send, your message runs through the flow you've selected. Most
chats use a flow like _prompt → history → model → output_. Concretely:

1. **Your prompt** is the entry node. History (if connected) loads recent
   messages from the current thread.
2. The **model node** calls [Groq](https://groq.com) — the inference provider —
   over a streaming API. Groq runs open-weight models (Llama, Qwen, Kimi,
   gpt-oss, Mixtral, Gemma, and others) on LPU hardware, which is why answers
   come in fast.
3. Tokens stream back as they're generated and land in your browser the same
   second they leave the GPU. No buffering until "done".
4. If the flow has extra blocks — web search, a yes/no branch, a sub-flow — they
   run in topological order before (or instead of) the final model. Anything not
   wired to the output node shows up as a collapsed grey context block above the
   reply, so you can always see what the model was actually fed.

Which models you can pick is whatever Groq currently serves; the list is
refreshed live from their API on startup, so when Groq adds a model it shows up
here without a deploy.

# Where do I get help?

A few options, in order of usefulness:

- **Click around the flow editor.** Most "how do I…" questions answer themselves
  once you see the nodes and what they connect to. Hover a node to see what it
  does.
- **Email** [support@openfast.chat](mailto:support@openfast.chat) — same
  address listed on the Privacy and Terms pages. Real human, not a bot. Use this
  for billing, account, or "this is broken" issues.
- **Delete your account** if you want to start over — Settings → Delete account.
  OAuth re-auth required, and the email is blocked from re-registering for 30
  days to keep the free tier honest.

If you find a bug, mention the flow you were on and roughly what time it
happened; the server logs are timestamped and that's usually enough to track it
down.
