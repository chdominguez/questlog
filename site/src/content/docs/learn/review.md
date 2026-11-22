---
title: Review
description: How Questie schedules reviews with FSRS spaced repetition, how review rounds work and how flashcard ratings set the next date.
sidebar:
  order: 4
---

Every challenge you answer becomes a review card. Questie schedules it with [FSRS](https://github.com/open-spaced-repetition/ts-fsrs), a modern spaced repetition algorithm, so you see each item right before you would forget it. What you miss comes back right away. What you know waits for days, then weeks.

## How cards are scheduled

| Your result | FSRS rating | Next review |
|---|---|---|
| Right | Good | Days out, longer each time you get it right |
| Right on a flashcard rated Easy | Easy | Further out than Good |
| Partial (or Hard on a flashcard) | Hard | Sooner than Good |
| Wrong, a miss, or Again on a flashcard | Again | Due right away |

Answers from levels, review rounds and the [arcade](/learn/games/) all count. A written answer graded 7 or more counts as right, 4 to 6 as partial, under 4 as a miss.

## Run a review round

1. Open a course. The **Review** tab shows a badge with the number of cards due.
2. Open **Review**. You get up to 25 due cards, the most overdue first, shuffled so levels mix.
3. Answer them like normal challenges. Reviews cost no lives and still earn XP and combos.
4. **Round complete** shows how many you cleared. If more cards are due, press **Another round**.

When nothing is due you see **Nothing due**. Come back tomorrow.

## Flashcards

A flashcard shows a prompt. Recall the answer, then press **Reveal** (or Space) and rate yourself honestly:

| Button | Key | Use it when |
|---|---|---|
| Again | 1 | You did not remember it |
| Hard | 2 | You got it with effort |
| Good | 3 | You remembered it |
| Easy | 4 | You knew it instantly |

Your rating sets the next date. Flashcards never cost a life.

## Reminders

Turn on reminders in **Profile**: press **Enable notifications**, then set a time for each course. Reminders arrive only at the times you set. On a phone, the [mobile apps](/learn/mobile/) use native notifications.

## Finished with a course

Press **Mark completed** on the course map. Its cards stop coming due and its reminder is removed. Press **Reopen** to bring them back.
