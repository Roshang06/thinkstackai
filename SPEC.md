# Thinkstack

Thinkstack is course software for schools. Instructors plan lessons with a model, publish courses, and later grade with a person in the loop. Students get the same lessons as a sequence of sections, with checks and small games, and a tutor that can talk while it edits.

## Decisions

- Anyone signed in can create and publish lessons and courses.
- Only an instructor's course accepts join requests and has a roster. A student's public course can be opened and used, not joined.
- Existing accounts stay students until they change role and institution on their profile.
- Birthday is required at signup and visible only on that person's profile.
- Explore covers are designed from the topic. No image API.
- A suggested length is a hint. The planner chooses the real number of sections from the prompt.
- The side panel is a conversation. The model replies in sentences and may also change the lesson. A question does not have to edit anything.
- Equations live inside the writing as `$...$` or `$$...$$`, not as their own block.
- A section should be long: several paragraphs under a heading, about three times the earlier drafts. A line appears before a check or an interaction, not between paragraphs.

## Now

1. Chat replies, and an asked-for subsection is actually inserted.
2. Reading view: no "Explanation 01" label, text as tall as its content, quiz stays closed until the right choice, wrong choices turn red.
3. Longer sections with math inside the paragraphs.
4. Explore cards, a library page, a roomier create page with notes, and a home page aimed at schools.
5. Signup role, institution, interests, birthday, and a profile page.
6. Courses: create, publish, request to join an instructor course, roster, attach and remove lessons, explore by instructor or institution.

Grading and due dates stay out of this pass.

## Reading and generation

- Custom lesson length is any whole number of minutes from 5 to 120. Custom level is free text. Presets stay available.
- A heading is rendered only when it is new. The model may write `<h2>Subtopic</h2>` inside the prose. `**word**` is bold.
- `$V$` stays in the sentence. `$$...$$` is its own line only when the formula is long or uses a structure such as a fraction.
- A quiz turns the whole card green only after the correct choice. A wrong choice is red.
- Moving to the next section scrolls to the top.
- Use selection keeps the highlighted text even after the button is pressed.
- While a lesson is drafting, Pause, Resume, and Skip this step accept a note. Skip fills an unfinished interaction and lets the rest continue. A faster model writes interactions first.
- Enrolled students see classmates and can leave. They do not see join requests. Leaving requires confirmation and removes the seat.
