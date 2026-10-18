# Thinkstack judging demo

A live screenshare, under three minutes. You talk while you click. Nothing is pre-recorded, and you do not wait for a lesson to generate on camera.

The lesson below is already public on the live site. Stay logged out the whole time. Logged out, the page shows **Ask the tutor**. If you are logged in as the owner, that button becomes **Edit with AI** and the student story disappears.

## The lesson to show

**Why a Ball's Vertical Speed is Zero at the Top of Its Flight**

https://www.thinkstackai.work/lessons/abbdea63-ba44-4249-b62c-e6a8880034d7

Open section **2. Why Vertical Speed is Zero at the Top**. That section has the equation, the simulation, and the check. Section 1 is a long read. Section 3 is a spare. Do not open either one during the recording.

This lesson won a comparison against a second generated lesson (a Python `for` loop) and the shorter built-in projectile page. The loop lesson put code fences inside quiz titles and used a second quiz as its interaction. The built-in projectile page is the backup, not the main path.

The prompt that produced the lesson, if a judge asks what a teacher types:

- Topic: Why a ball's vertical speed is zero at the top of its flight
- Level: High school
- Time: 5 minutes (the planner expanded it to about 12)
- Notes: One idea only. Short paragraphs. Include a check about the velocity at the peak, and a simple simulation or graph of the path. No programming.

Do not type this during the video. Generation takes a couple of minutes.

## Before you record

1. Deploy the current local changes first, then record the live site. The lesson content is already on https://www.thinkstackai.work. Two camera fixes are only in the working tree until you push: the tutor panel pushes the lesson aside instead of covering it, and interaction frames no longer show an inner scrollbar. If you record before that deploy, use http://localhost:3000 with `npm run dev` running. The lesson id is the same.
2. Log out. The top right must say **Sign up** and **Log in**.
3. Use a window at least 1280 pixels wide, browser zoom at 100%. Hide the bookmarks bar.
4. Bookmark the lesson URL. Close every other tab. Turn on Do Not Disturb.
5. Rehearse the simulation once. The ball completes a flight in a few seconds. You will pause it near the top.
6. Rehearse both tutor questions once. Answers vary. You want to hear the shape of a good reply before you are live. The exact lines that worked in rehearsal are in the clock below.

## What you are proving

A teacher describes one idea. A student, with no account, can read the page, pause a simulation, miss a check, get it right, and ask a tutor that marks the passage and will not pick the quiz choice.

## The clock

Speak in short sentences. Click while you talk. If you fall behind, drop the second tutor question and go to the close.

### 0:00–0:15 — Open on the lesson, not the homepage

Paste the lesson URL. You should already be logged out.

Say:

> Teachers spend the weekend writing the lesson. Students get stuck on it at midnight. Thinkstack writes the page, and then tutors the student inside it. This lesson is public. No account.

Do not read the summary under the title.

### 0:15–0:35 — One equation

Click **2. Why Vertical Speed is Zero at the Top**.

Scroll until this equation is on screen:

> v = v₀ − gt

Say:

> One idea. Vertical speed drops by g every second, so on the way up it has to pass through zero. The equation sits in the paragraph, the way it would on a worksheet.

Do not read the paragraphs above it.

### 0:35–1:15 — Pause the simulation

Scroll to **Watch the speed hit zero**. Let the ball rise. When the readout is near **0 m/s**, click **Pause**. If you miss it, click **Resume** and catch the next pass. After the top, the number goes negative. That is the way down.

Say:

> They don't only read it. They pause the ball at the top and watch the vertical speed hit zero.

The frame should show a teal arc, a **Pause** button, and a speed readout. No scrollbar inside the white box.

### 1:15–1:50 — Miss the check, then get it

Scroll to **Why is the ball's vertical speed zero at the top of its flight?**

Click this one first. It turns red and locks:

> Because gravity stops acting at the top, making the speed zero.

Then click this one. The choices lock, the row turns green, and a short explanation appears under the question:

> Because it is transitioning from moving up to moving down, and must momentarily stop before reversing direction.

Say:

> The tempting answer is that gravity switches off. That one goes red. The explanation stays hidden until the right choice.

Do not say that the student cannot continue until the check is right. **Continue** stays available the whole time. Leave it alone.

### 1:50–2:25 — Tutor marks a sentence

Click **Ask the tutor**. The lesson should shift left and the panel should sit beside it, not on top of the title. If the title is cut off, you are on the live site before the layout deploy. Switch to localhost or stop and deploy.

Click the question box. Type this exactly:

> Why is gravity still acting when the ball stops at the top?

Click **Ask**. It usually takes a few seconds. A sentence in the section gets a mark, and the reply is a couple of sentences. In rehearsal it marked "As the ball climbs, it loses speed..." and said gravity keeps pulling downward after the speed hits zero.

Say, while it thinks:

> This is the student view. No account. The tutor can see this lesson, and it can point at the sentence that answers the question. It cannot edit the page.

If the spinner lasts past about fifteen seconds, say "It usually answers in a few seconds," close the panel, and jump to the close.

### 2:25–2:45 — Tutor will not pick the choice

Clear the box. Type this exactly:

> Which choice should I click?

Click **Ask**. In rehearsal the reply was: "I can't tell you which choice to pick, but think about why the ball must stop momentarily at the peak before falling back down."

Say, after it answers:

> Ask it for the choice, and it won't pick one.

If the reply names one of the four choices, do not read that choice aloud. Close the tutor and go to the close.

Do not ask "what is the answer to the check?" That wording sometimes gets a full explanation of the physics, which undercuts the point.

### 2:45–3:00 — Close

Click **Close tutor**. Leave the green check or the equation on screen.

Say:

> One topic in. A page a student can read, try, and ask about. That's Thinkstack.

Stop talking. Do not open section 3. Do not click **Remix**. Do not start a new lesson.

## If something breaks

| What you see | What you do |
| --- | --- |
| **Edit with AI** instead of **Ask the tutor** | You are logged in as the owner. Log out, reload the lesson URL, and start this section again. |
| The simulation says **Building this interaction**, or the ball never moves | Leave it. Open the backup lesson below. You still have the quiz and the tutor on that page. |
| Tutor shows an error | Close the panel. Finish on the green check with the close line. |
| You opened section 1 or 3 | Click section 2 and continue. Section 3 has a slider labeled **Drag along the flight**. It is safe, but it is not the rehearsed beat. |
| You clicked **Continue** and landed on section 3 | Click section 2 in the tab row. |

### Backup lesson

https://www.thinkstackai.work/lessons/seed-projectile

Stay logged out. The page is one section.

1. Scroll to **Launch it**. Drag the **Angle** slider. The arc changes.
2. Scroll to the check: "With no air resistance, what happens to the horizontal velocity during the flight?"
3. Click **It drops to zero at the top** first. It goes red.
4. Click **It stays constant**. That one is right. Gravity pulls vertically, so the horizontal velocity is unchanged.
5. Use the same two tutor questions, worded for this page: "Why does horizontal speed stay constant?" and "Which choice should I click?"
6. Stop at the check. The flashcards and the code block are below it. Skip them unless you are ahead and **Run** prints an air time.

On the live site, the graph above the simulation still shows the raw expression `-0.15*x^2+1.2*x`. Do not linger on that line. The local code hides it for readers, after you deploy.

## Lines to leave out

- "Every lesson has a simulation, a graph, and code." Some do. This one has a simulation and an equation.
- "Students write and compile their own programs." On this page they run an example when a lesson includes one.
- "You can't continue until the quiz is right." Continue is always there.
- "We grade submissions" or "there are due dates." Those are not in the product.
- "The tutor never tells you anything useful." It explains. It refuses when asked which choice to click.
- "I just generated this." You did not, and a live generation will not finish inside three minutes.

## Setup that is already done

The lesson is public, so a logged-out browser can open it. The interaction on section 2 is a pauseable flight with a vertical-speed readout. Section 3 is a slider that shows vertical speed changing while horizontal speed stays put. Both are stored with the lesson, so they are on the live site now.

The Python lesson at `/lessons/01af59f6-f3b7-4b26-b61f-c9035a72a9a2` is public too. Leave it out of the video.
