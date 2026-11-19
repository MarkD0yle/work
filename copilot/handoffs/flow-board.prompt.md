---
mode: agent
description: Build a flow board for one app — a snapshot of every screen joined by arrows, with notes on interactions, edge cases and considerations.
---

# Flow board

## What I want

Build a flow board for one app in this repo. It is a single page with a
FigJam-style canvas that I can zoom in and out of and scroll around. On it,
the app is laid out the way a designer would in Figma: a snapshot of every screen, arrows
showing which interaction leads to which screen, and notes beside each one.

Someone who has never opened the app should be able to read the board from
left to right and understand what the app does and how its parts connect.

Ask me which app to map before you start.

## What goes on the board

**A frame for everything a user can be looking at:**

- Full screens and detail views
- Modals and confirm dialogs
- Side panels and drawers
- Pop-ups: menus, popovers, notification lists, toasts
- Each step of a wizard or multi-step form
- States worth seeing on their own: empty, loading, error, validation
  failure, read-only, or a different role's view

One frame per distinct layout. Do not make a frame for every data row or every
filter value.

**Each frame shows:**

- A title, and a label saying what kind of thing it is (screen, modal, side
  panel, pop-up, step or state)
- A real snapshot of it, taken from the running app. For a modal, panel or
  pop-up, keep the screen behind it in the picture.
- One or two lines on what the user sees and what it is for
- Three short lists of notes, each shown only when it has entries:
  - **Interactions** — what the user can do here that does not lead
    somewhere else, such as sort, filter, toggle or edit in place
  - **Edge cases** — conditions that change what happens: no data, invalid
    input, missing permission, limits, a disabled action and the reason for it
  - **Considerations** — what a designer or reviewer should know that the
    snapshot does not show: what is saved, what resets, keyboard behaviour,
    what is mocked, what is missing
- The file it comes from, in small type

**Arrows between frames:**

- One arrow for every interaction that leads to another frame
- Each arrow is labelled with the interaction in the UI's own words, such as
  "Click Reject" or "Submit with errors"
- If the arrow only applies in some cases, say when, such as "Approvers only"
- Leave out plain "Close" and "Cancel" arrows that only go back to the
  previous frame

## How to lay it out

- Group the frames into flows: the jobs a user comes to do, such as "Create a
  record" or "Approve a request". Give each flow a title and a one-line
  summary.
- One horizontal lane per flow, stacked top to bottom.
- Inside a lane, frames run left to right in the order a user meets them.
- The main path of screens reads along the top of the lane. Modals, panels,
  pop-ups and states sit below the screen they open from.
- Leave enough room between frames for the arrow labels to be read.
- No frame overlaps another, and no arrow or label covers a snapshot.

## The canvas

The board sits on a FigJam-style canvas, not a normal scrolling web page.

- The canvas fills the whole browser window and has no edges: I can keep
  moving in any direction, past the frames into empty space.
- A light dotted grid in the background that moves and scales with the board,
  so it feels like a whiteboard.
- **Scroll around:** two-finger scroll or the mouse wheel moves the canvas up,
  down, left and right. Dragging on empty canvas, or holding Space and
  dragging anywhere, also moves it.
- **Zoom in and out:** pinch, or hold Ctrl or Cmd and scroll. Zoom towards
  wherever the pointer is, not towards the centre. Go from far enough out to
  see the whole board down to close enough to read a snapshot at full size.
- Zooming and moving must be smooth, with no lag, on a board of 30 frames.
- Snapshots and text stay sharp at every zoom level; nothing goes blurry when
  I zoom in.
- **Zoom controls** in a corner: zoom out, the current zoom as a percentage,
  zoom in, and **Fit** to show the whole board. Clicking the percentage
  returns to 100%.
- Keyboard: plus and minus zoom, 1 fits the whole board, arrow keys move.
- A small **minimap** in a corner showing the whole board and the part I am
  looking at. Clicking or dragging in it moves the view.
- The board opens fitted to the window. The header and controls stay fixed
  in place while the canvas moves beneath them.
- The page itself never scrolls and the browser's own page zoom is not
  triggered by these gestures.

## How the page behaves

- Clicking a snapshot shows it at full size.
- Hovering a frame highlights its arrows and dims the rest.
- A header with the app's name, a two or three sentence summary of what the
  app is for, the date the board was built, and counts of flows, frames and
  arrows.
- Links in the header that jump to each flow.
- A legend for the frame kinds.
- An "Open questions" list of anything you could not confirm.
- One self-contained file that opens with no network connection, so I can
  send it to someone.

## How it should look

Neutral and quiet, so the snapshots are what people look at. Light grey
canvas, white frames, dark text, one accent colour for arrows and one for edge
cases. Square corners. Follow the system's light or dark setting. Frame titles
must stay readable when the whole board is fitted on screen.

## Rules

1. **Do not change the app.** Read it and run it only. If you find a bug,
   tell me at the end and do not fix it.
2. **Put everything you create in one new folder** for this board, under
   `docs/flow-board/`. Touch nothing else.
3. **Describe what the code does, not what you expect it to do.** Every frame
   and arrow must come from code you read. If you cannot confirm something,
   put it in Open questions and leave it off the board.
4. **Use plain words.** Name things the way the UI names them, not the way
   the code does. Keep every note to one line.
5. **Take real snapshots from the running app.** If you need to install
   something to do that, ask me first. If I say no, build the board with
   placeholders and give me a list of the snapshots to take by hand.
6. **Look at every snapshot** and check it shows what its title says before
   you put it on the board.
7. **No AI features on the page.** No chat box and no model calls.
8. **English only.**

## Before you say it is done

Open the board and check, by looking at it:

- Every frame is there, in the right flow, with the right snapshot
- Every arrow starts and ends on the right frames and its label is readable
- Every frame except the first has at least one arrow pointing to it
- Nothing overlaps
- The canvas scrolls in every direction and zooms in and out towards the
  pointer, smoothly, and snapshots stay sharp when zoomed in
- The zoom controls, Fit, the minimap, the flow links, the full-size view and
  Open questions work
- Nothing outside the board's folder has changed

## What to tell me at the end

1. Where the board is
2. How many flows, frames of each kind, and arrows it has
3. Any frames without a snapshot, and why
4. The open questions
5. Any bugs you noticed in the app

## Updating it later

When I ask you to update the flow board, do not start again. Compare the
existing board with the app as it is now, add, change or remove frames and
arrows to match, retake the snapshots, and tell me what changed.
